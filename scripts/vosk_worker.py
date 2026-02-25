#!/usr/bin/env python3
import base64
import json
import os
import sys

try:
    from vosk import KaldiRecognizer, Model, SetLogLevel
except Exception as exc:
    print(json.dumps({"type": "fatal", "message": f"Failed to import vosk: {exc}"}), flush=True)
    sys.exit(1)

SetLogLevel(-1)

model_path = os.environ.get("LINT0_VOSK_MODEL_PATH")
if not model_path:
    print(json.dumps({"type": "fatal", "message": "LINT0_VOSK_MODEL_PATH is required"}), flush=True)
    sys.exit(1)

if not os.path.isdir(model_path):
    print(json.dumps({"type": "fatal", "message": f"Model path not found: {model_path}"}), flush=True)
    sys.exit(1)

model = Model(model_path)
recognizer = KaldiRecognizer(model, 16000)
recognizer.SetWords(False)

def emit(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)

for raw in sys.stdin:
    raw = raw.strip()
    if not raw:
        continue

    try:
        command = json.loads(raw)
    except json.JSONDecodeError:
        emit({"type": "error", "message": "Invalid JSON command"})
        continue

    cmd_type = command.get("type")

    if cmd_type == "audio":
        b64 = command.get("pcm16_base64")
        if not isinstance(b64, str):
            emit({"type": "error", "message": "Missing pcm16_base64"})
            continue

        try:
            pcm = base64.b64decode(b64)
        except Exception:
            emit({"type": "error", "message": "Invalid base64 audio"})
            continue

        if recognizer.AcceptWaveform(pcm):
            parsed = json.loads(recognizer.Result())
            text = (parsed.get("text") or "").strip()
            emit({"type": "partial", "text": text})
        else:
            parsed = json.loads(recognizer.PartialResult())
            text = (parsed.get("partial") or "").strip()
            emit({"type": "partial", "text": text})

    elif cmd_type == "commit":
        parsed = json.loads(recognizer.FinalResult())
        text = (parsed.get("text") or "").strip()
        emit({"type": "final", "text": text})
        recognizer = KaldiRecognizer(model, 16000)
        recognizer.SetWords(False)

    elif cmd_type == "reset":
        recognizer = KaldiRecognizer(model, 16000)
        recognizer.SetWords(False)
        emit({"type": "reset_ok"})

    else:
        emit({"type": "error", "message": f"Unknown command type: {cmd_type}"})
