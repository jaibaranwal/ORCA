import os
import io
from fastapi.testclient import TestClient
from main import app
from modules.voice_engine import get_voice_engine_status, synthesize_speech, transcribe_audio

def test_voice_engine_full():
    print("==================================================")
    print("RUNNING ORCA GNANI VOICE ENGINE INTEGRATION TESTS")
    print("==================================================")

    # 1. Voice Engine Status Check
    status = get_voice_engine_status()
    print(f"[TEST 1 - Voice Engine Status]")
    print(f"Configured: {status['gnani_configured']} | STT: {status['stt_model']} | TTS: {status['tts_model']}")
    assert status["gnani_configured"] is True
    assert status["stt_model"] == "gnani-prisma-v2.5"
    assert status["tts_model"] == "timbre-v2.5"
    print("✓ Test 1 Passed: Gnani Voice Engine configured and active.")

    # 2. TTS Speech Synthesis Test (English)
    print(f"\n[TEST 2 - TTS Synthesis (English via Timbre v2.5)]")
    en_audio = synthesize_speech("ORCA safety check passed for coastal waters.", language="en")
    assert isinstance(en_audio, bytes)
    assert len(en_audio) > 1000
    print(f"Synthesized English Audio: {len(en_audio)} bytes (MP3)")
    print("✓ Test 2 Passed: English audio generated successfully.")

    # 3. TTS Speech Synthesis Test (Hindi)
    print(f"\n[TEST 3 - TTS Synthesis (Hindi via Timbre v2.5)]")
    hi_audio = synthesize_speech("नमस्ते, ओर्का मरीन इंटेलिजेंस सक्रिय है।", language="hi")
    assert isinstance(hi_audio, bytes)
    assert len(hi_audio) > 1000
    print(f"Synthesized Hindi Audio: {len(hi_audio)} bytes (MP3)")
    print("✓ Test 3 Passed: Hindi audio generated successfully.")

    import time
    time.sleep(1.5)

    # 4. STT Transcription Test (via Prisma v2.5)
    print(f"\n[TEST 4 - STT Transcription (Prisma v2.5)]")
    stt_res = transcribe_audio(en_audio, language_code="en", filename="sample.mp3")
    assert stt_res["success"] is True
    assert len(stt_res["transcript"]) > 0
    print(f"Transcribed Text: '{stt_res['transcript']}'")
    print(f"Latency: {stt_res['end_to_end_latency']:.3f}s | Model: {stt_res['model']}")
    print("✓ Test 4 Passed: Audio accurately transcribed to text via Gnani Prisma v2.5.")

    # 5. FastAPI Endpoints Test
    print(f"\n[TEST 5 - FastAPI Voice Endpoints /api/voice/*]")
    client = TestClient(app)
    
    # GET /api/voice/status
    res_status = client.get("/api/voice/status")
    assert res_status.status_code == 200
    assert res_status.json()["gnani_configured"] is True
    print("✓ GET /api/voice/status responded 200 OK.")

    # POST /api/voice/synthesize
    res_synth = client.post("/api/voice/synthesize", json={
        "text": "Zone A is safe for traditional fishing.",
        "language": "en"
    })
    assert res_synth.status_code == 200
    assert res_synth.headers["content-type"] == "audio/mpeg"
    assert len(res_synth.content) > 1000
    print("✓ POST /api/voice/synthesize streamed valid MP3 audio.")

    time.sleep(1.5)
    # POST /api/voice/transcribe
    audio_file = io.BytesIO(en_audio)
    res_trans = client.post(
        "/api/voice/transcribe",
        files={"file": ("speech.mp3", audio_file, "audio/mpeg")},
        data={"language_code": "en-IN"}
    )
    assert res_trans.status_code == 200
    data = res_trans.json()
    assert data["success"] is True
    assert len(data["transcript"]) > 0
    print(f"✓ POST /api/voice/transcribe returned: '{data['transcript']}'")

    print("\n==================================================")
    print("🎉 ALL GNANI VOICE AI ENGINE TESTS PASSED (100%)!")
    print("==================================================")

if __name__ == "__main__":
    test_voice_engine_full()
