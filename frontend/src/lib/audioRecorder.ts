/**
 * Browser Audio Recorder for ORCA Marine Intelligence.
 * 
 * Captures microphone stream directly using the Web Audio API and encodes
 * into standard 16kHz 16-bit Mono Linear PCM WAV format.
 * 
 * This ensures full compatibility with speech recognition APIs (like Gnani Prisma STT)
 * without depending on browser-specific MediaRecorder formats (webm/opus, mp4).
 */

export interface ActiveAudioRecording {
  stop: () => Promise<Blob>;
}

function writeAsciiString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Downsamples float PCM samples to target sample rate using box averaging.
 */
function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (outputRate === inputRate) {
    return buffer;
  }
  if (outputRate > inputRate) {
    return buffer;
  }
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

/**
 * Encodes 1-channel PCM float samples into standard 16-bit Linear PCM WAV Blob.
 */
export function encodeWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const dataSize = samples.length * 2; // 2 bytes per sample (16-bit)
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size = 16 for PCM
  view.setUint16(20, 1, true); // AudioFormat = 1 (Linear PCM)
  view.setUint16(22, 1, true); // NumChannels = 1 (Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample / 8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample / 8)
  view.setUint16(34, 16, true); // BitsPerSample = 16

  // data sub-chunk
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM audio samples (clamped float32 [-1.0, 1.0] -> signed int16 [-32768, 32767])
  let byteOffset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(byteOffset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    byteOffset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Starts microphone recording using Web Audio API ScriptProcessorNode.
 * Returns an ActiveAudioRecording handle whose stop() method resolves with a 16kHz mono WAV Blob.
 */
export async function startAudioRecording(): Promise<ActiveAudioRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const source = audioCtx.createMediaStreamSource(stream);

  // 4096 sample buffer size, 1 input channel, 1 output channel
  const bufferSize = 4096;
  const recorderNode = audioCtx.createScriptProcessor(bufferSize, 1, 1);
  const sampleChunks: Float32Array[] = [];

  recorderNode.onaudioprocess = (e) => {
    const channelData = e.inputBuffer.getChannelData(0);
    sampleChunks.push(new Float32Array(channelData));
  };

  // Connect through a zero-gain node to destination to prevent speaker feedback howl
  const silenceGain = audioCtx.createGain();
  silenceGain.gain.value = 0.0;

  source.connect(recorderNode);
  recorderNode.connect(silenceGain);
  silenceGain.connect(audioCtx.destination);

  let isStopped = false;

  return {
    stop: async (): Promise<Blob> => {
      if (isStopped) {
        throw new Error('Recording already stopped');
      }
      isStopped = true;

      recorderNode.disconnect();
      source.disconnect();
      silenceGain.disconnect();
      stream.getTracks().forEach((track) => track.stop());

      const inputSampleRate = audioCtx.sampleRate;
      await audioCtx.close();

      let totalSamples = 0;
      for (const chunk of sampleChunks) {
        totalSamples += chunk.length;
      }

      const merged = new Float32Array(totalSamples);
      let offset = 0;
      for (const chunk of sampleChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      // Target standard 16kHz speech recognition sample rate
      const targetSampleRate = 16000;
      const processedSamples = downsampleBuffer(merged, inputSampleRate, targetSampleRate);

      return encodeWavBlob(processedSamples, targetSampleRate);
    },
  };
}
