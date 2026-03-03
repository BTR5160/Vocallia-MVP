import json
import wave
from vosk import Model, KaldiRecognizer

MODEL_PATH = "Models/linto-asr-ar-tn-0.1/vosk-model" 
WAV_PATH = "clean.wav"  # 16kHz mono wav recommended

wf = wave.open(WAV_PATH, "rb")
if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getcomptype() != "NONE":
    raise ValueError("WAV must be mono PCM16 (16-bit). Convert it to 16kHz mono.")

model = Model(MODEL_PATH)
rec = KaldiRecognizer(model, wf.getframerate())
rec.SetWords(True)

results = []
while True:
    data = wf.readframes(4000)
    if len(data) == 0:
        break
    if rec.AcceptWaveform(data):
        results.append(json.loads(rec.Result()))

final = json.loads(rec.FinalResult())
text = " ".join([r.get("text","") for r in results] + [final.get("text","")]).strip()

print("TRANSCRIPT:")
print(text)