import os
import json
import wave
from pathlib import Path

from vosk import Model, KaldiRecognizer
from openai import OpenAI


from dotenv import load_dotenv
load_dotenv(".env.local")



from google import genai
from google.genai import types

# ====== CONFIG ======
# Change these paths to match your setup
LINT0_MODEL_PATH = "Models/linto-asr-ar-tn-0.1/vosk-model"
AUDIO_PATH = "clean.wav"   # put your test wav here (recommended: 16kHz mono PCM16)

# OpenAI key from env (recommended)
# export OPENAI_API_KEY="sk-..."
OPENAI_MODEL = "gpt-4o-transcribe"
LANGUAGE_HINT = "ar"  # helps for Arabic/dialect
# ====================


def transcribe_linto_vosk(model_path: str, wav_path: str) -> str:
    wf = wave.open(wav_path, "rb")

    # Vosk expects mono PCM 16-bit. Sample rate can vary but 16k is best.
    if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getcomptype() != "NONE":
        raise ValueError("WAV must be mono PCM16 (16-bit). Convert to 16kHz mono for best results.")

    model = Model(model_path)
    rec = KaldiRecognizer(model, wf.getframerate())
    rec.SetWords(True)

    parts = []
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            parts.append(json.loads(rec.Result()).get("text", ""))

    final = json.loads(rec.FinalResult()).get("text", "")
    parts.append(final)

    return " ".join([p for p in parts if p]).strip()


def transcribe_openai(wav_path: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY env var. Set it first: export OPENAI_API_KEY='sk-...'")

    client = OpenAI(api_key=api_key)
    with open(wav_path, "rb") as f:
        tr = client.audio.transcriptions.create(
            model=OPENAI_MODEL,
            file=f,
            language=LANGUAGE_HINT
        )
    return tr.text.strip()

def transcribe_openai_forced(wav_path: str) -> str:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    with open(wav_path, "rb") as f:
        tr = client.audio.transcriptions.create(
            model="gpt-4o-transcribe",
            file=f,
            language="ar",
        )
    return tr.text.strip()

def transcribe_openai_auto(wav_path: str) -> str:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    with open(wav_path, "rb") as f:
        tr = client.audio.transcriptions.create(
            model="gpt-4o-transcribe",
            file=f
            # no language param
        )
    return tr.text.strip()

from google import genai
from google.genai import types
from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv(".env.local")

def transcribe_gemini(wav_path: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY in .env.local")

    client = genai.Client(api_key=api_key)
    audio_bytes = Path(wav_path).read_bytes()

    prompt = (
        "Transcris exactement cet audio en dialecte tunisien (تونسي). "
        "Garde les mots français tels quels. "
        "Retourne uniquement le texte."
    )

    resp = client.models.generate_content(
        model="gemini-1.5-flash",
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav"),
                    types.Part.from_text(text=prompt),  # ✅ keyword argument
                ],
            )
        ],
    )

    return (resp.text or "").strip()


from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv
load_dotenv(".env.local")
def transcribe_elevenlabs(wav_path: str) -> str:
    api_key = os.getenv("ELEVEN_API_KEY")
    if not api_key:
        raise RuntimeError("Missing ELEVEN_API_KEY in .env.local")

    client = ElevenLabs(api_key=api_key)

    # ElevenLabs STT (Scribe v2) accepts audio/video files for transcription. :contentReference[oaicite:2]{index=2}
    with open(wav_path, "rb") as f:
        transcript = client.speech_to_text.convert(
            file=f,
            model_id="scribe_v2",  # Scribe v2 :contentReference[oaicite:3]{index=3}
            # optional knobs you can add later:
            # language_code="ar",  # if you want to force Arabic instead of auto-detect
        )

    # SDK returns an object; text is typically available as .text
    return (getattr(transcript, "text", "") or "").strip()

def main():
    wav_path = str(Path(AUDIO_PATH).expanduser())
    print("\n=== INPUT FILE ===")
    print(wav_path)

    #print("\n=== Linto (Vosk) ===")
    #linto_text = transcribe_linto_vosk(LINT0_MODEL_PATH, wav_path)
    #print(linto_text if linto_text else "[EMPTY]")

    print("\n=== OpenAI STT ===")
    openai_text = transcribe_openai(wav_path)
    print(openai_text if openai_text else "[EMPTY]")

    print("\n=== OpenAI STT AUTO ===")
    openai_text = transcribe_openai_auto(wav_path)
    print(openai_text if openai_text else "[EMPTY]")

    

    #print("\n=== Gemini (file transcription) ===")
    #gemini_text = transcribe_gemini(wav_path)
    #print(gemini_text if gemini_text else "[EMPTY]")

    #print("\n=== ElevenLabs STT (Scribe v2) ===")
    #eleven_text = transcribe_elevenlabs(wav_path)
    #print(eleven_text if eleven_text else "[EMPTY]")

    #print("\n=== QUICK DIFF (rough) ===")
    #print("Linto chars:", len(linto_text))
    #print("OpenAI chars:", len(openai_text))
    #print("OpenAI chars:", len(gemini_text))


if __name__ == "__main__":
    main()