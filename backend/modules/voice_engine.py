from __future__ import annotations

import os
import io
import tempfile
import logging
from typing import Dict, Any, Optional, Union, BinaryIO
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("orca.voice_engine")

GNANI_API_KEY = os.getenv("GNANI_API_KEY", "")

# Language mapping from ORCA language codes to Gnani BCP-47 codes
LANGUAGE_MAP = {
    "en": "en-IN",
    "english": "en-IN",
    "hi": "hi-IN",
    "hindi": "hi-IN",
    "hinglish": "hi-IN",
    "ml": "ml-IN",
    "malayalam": "ml-IN",
    "ta": "ta-IN",
    "tamil": "ta-IN",
    "te": "te-IN",
    "telugu": "te-IN",
    "kn": "kn-IN",
    "kannada": "kn-IN",
    "auto": "hi-IN",
}

# Default female and male voices for Timbre v2.5
DEFAULT_VOICES = {
    "hi-IN": "Nalini",
    "en-IN": "Nalini",
    "ml-IN": "Nalini",
    "ta-IN": "Nalini",
    "te-IN": "Nalini",
    "kn-IN": "Nalini",
}

def get_voice_engine_status() -> Dict[str, Any]:
    """Returns the operational status of Gnani Voice Engine."""
    key = os.getenv("GNANI_API_KEY", "")
    configured = bool(key and len(key) > 10)
    voices_count = 0
    available_voices = []

    if configured:
        try:
            from gnani.tts import GnaniTTSClient
            available_voices = GnaniTTSClient.supported_voices(model="timbre-v2.5")
            voices_count = len(available_voices)
        except Exception as e:
            logger.warning(f"Failed to query Gnani supported voices: {e}")

    return {
        "gnani_configured": configured,
        "stt_engine": "Gnani Prisma v2.5 ASR",
        "tts_engine": "Gnani Timbre v2.5 Neural TTS",
        "stt_model": "gnani-prisma-v2.5",
        "tts_model": "timbre-v2.5",
        "supported_languages": ["en-IN", "hi-IN", "ml-IN", "ta-IN", "te-IN", "kn-IN"],
        "voices_count": voices_count,
        "sample_voices": available_voices[:8] if available_voices else ["Nalini", "Kaveri", "Asmita", "Pranav"]
    }

def synthesize_speech(
    text: str,
    language: str = "en",
    voice: Optional[str] = None
) -> bytes:
    """
    Synthesizes natural spoken audio from text using Gnani Timbre v2.5.
    Returns raw MP3 audio bytes.
    """
    api_key = os.getenv("GNANI_API_KEY", "")
    if not api_key:
        raise ValueError("GNANI_API_KEY is not configured in environment.")

    clean_text = text.replace("*", "").replace("#", "").strip()
    if not clean_text:
        raise ValueError("Cannot synthesize empty text.")

    bcp_lang = LANGUAGE_MAP.get(language.lower(), "en-IN")
    selected_voice = voice or DEFAULT_VOICES.get(bcp_lang, "Nalini")

    from gnani.tts import GnaniTTSClient, AudioConfig

    client = GnaniTTSClient(api_key=api_key)
    audio_config = AudioConfig(
        container="mp3",
        sample_rate=24000,
        bitrate="128k"
    )

    import time
    logger.info(f"Synthesizing speech via Gnani Timbre v2.5 | lang={bcp_lang} | voice={selected_voice}")
    
    for attempt in range(3):
        try:
            audio_bytes = client.synthesize(
                clean_text,
                voice=selected_voice,
                model="timbre-v2.5",
                language=bcp_lang,
                speed=1.0,
                audio_config=audio_config
            )
            return audio_bytes
        except Exception as e:
            if ("429" in str(e) or "RATE_LIMITED" in str(e)) and attempt < 2:
                logger.warning(f"Gnani TTS rate limited (429). Retrying after {1.5 * (attempt + 1)}s backoff...")
                time.sleep(1.5 * (attempt + 1))
                continue
            raise

def transcribe_audio(
    audio_content: bytes,
    language_code: str = "auto",
    filename: Optional[str] = None
) -> Dict[str, Any]:
    """
    Transcribes audio into text using Gnani Prisma v2.5 ASR.
    Supports WAV, MP3, WebM, OGG, etc.
    """
    api_key = os.getenv("GNANI_API_KEY", "")
    if not api_key:
        raise ValueError("GNANI_API_KEY is not configured in environment.")

    bcp_lang = LANGUAGE_MAP.get(language_code.lower(), "hi-IN")
    suffix = ".wav"
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        if ext in [".wav", ".mp3", ".ogg", ".webm", ".m4a", ".flac"]:
            suffix = ext

    from gnani.stt import GnaniSTTClient

    client = GnaniSTTClient(api_key=api_key)

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        tmp.write(audio_content)

    import time
    try:
        for attempt in range(3):
            try:
                logger.info(f"Transcribing audio via Gnani Prisma v2.5 (attempt {attempt+1}) | lang={bcp_lang} | file={tmp_path}")
                result = client.transcribe(
                    tmp_path,
                    language_code=bcp_lang,
                    format="transcribe"
                )
                return {
                    "success": True,
                    "transcript": result.get("transcript", "").strip(),
                    "model": result.get("model", "gnani-prisma-v2.5"),
                    "language_code": bcp_lang,
                    "processing_time": result.get("processing_time", 0.0),
                    "end_to_end_latency": result.get("end_to_end_latency", 0.0)
                }
            except Exception as e:
                if ("429" in str(e) or "RATE_LIMITED" in str(e)) and attempt < 2:
                    logger.warning(f"Gnani STT rate limited (429). Retrying after {2.0 * (attempt + 1)}s backoff...")
                    time.sleep(2.0 * (attempt + 1))
                    continue
                raise
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
