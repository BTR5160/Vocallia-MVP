# Vocallia MVP

Browser-based voice agent MVP with two modes:

- Existing realtime WebRTC demo on `/`.
- New **Live Call Test** flow on `/live-call` using a standalone Node WebSocket server (Vosk STT + OpenAI turn generation + ElevenLabs streaming TTS) with barge-in.

## Environment variables

Create `.env.local` (for Next.js) and export the same values for the WS server process:

```bash
OPENAI_API_KEY=sk-...
ELEVEN_API_KEY=...
ELEVEN_VOICE_ID=...
LINT0_VOSK_MODEL_PATH=/absolute/path/to/linagora/linto-asr-ar-tn-0.1
# optional
ELEVEN_MODEL_ID=eleven_flash_v2_5
OPENAI_MODEL=gpt-4o-mini
WS_PORT=8787
NEXT_PUBLIC_VOICE_WS_URL=ws://localhost:8787
```

> Required for live-call: `OPENAI_API_KEY`, `ELEVEN_API_KEY`, `LINT0_VOSK_MODEL_PATH`.

## Run locally

Install once:

```bash
pnpm install
```

Terminal 1 (dashboard):

```bash
pnpm dev
```

Terminal 2 (voice WebSocket server):

```bash
pnpm ws
```

Open:

- `http://localhost:3000/` for the existing realtime page.
- `http://localhost:3000/live-call` for the new browser live call test.

## Live Call Test protocol

Client -> Server:

- `{type:"audio", turnId, seq, pcm16_base64}`
- `{type:"commit", turnId}`
- `{type:"barge_in", turnId}`
- `{type:"reset"}`

Server -> Client:

- `{type:"partial", text}`
- `{type:"final", text}`
- `{type:"assistant_json", data:{intent,say,slots}}`
- `{type:"tts_chunk", turnId, audio_base64, mime:"audio/mpeg"}`
- `{type:"tts_end", turnId}`
- `{type:"error", message}`

## Barge-in behavior

- Browser VAD detects speech start while assistant audio is playing.
- Client immediately stops audio playback.
- Client sends `barge_in`, increments local `turnId`, and continues streaming mic audio under new turn.
- Server cancels current ElevenLabs stream and emits `tts_end`; stale chunks are ignored by `turnId` checks.
