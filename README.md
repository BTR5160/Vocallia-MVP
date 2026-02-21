# Vocallia MVP

Browser-based realtime voice agent MVP using OpenAI Realtime WebRTC + ElevenLabs streaming TTS.

## Features

- Continuous browser mic conversation (no hard turn time limit).
- Barge-in support:
  - Realtime event-driven interruption (`input_audio_buffer.speech_started`), and
  - Local VAD fallback (mic energy threshold) to stop agent playback quickly.
- Assistant text generation through OpenAI Realtime.
- Spoken output through ElevenLabs (server-side key usage, custom `ELEVEN_VOICE_ID`).
- Live transcript with speaker labels (`Client`, `Vocallia`).
- Status badge (`Listening`, `Speaking`, `Interrupted`) + optional debug events panel.

## Environment variables

Create `.env.local`:

```bash
OPENAI_API_KEY=sk-...
ELEVEN_API_KEY=...
ELEVEN_VOICE_ID=...
ELEVEN_MODEL_ID=eleven_flash_v2_5
# optional:
# OPENAI_REALTIME_MODEL=gpt-realtime
# NEXT_PUBLIC_OPENAI_REALTIME_URL=https://api.openai.com/v1/realtime
```

> `OPENAI_API_KEY`, `ELEVEN_API_KEY`, `ELEVEN_VOICE_ID` are required.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`, click **Start**, grant microphone permission, and start speaking.

## Architecture

1. `POST /api/realtime/session` creates an OpenAI Realtime session server-side using `OPENAI_API_KEY`, returns ephemeral session data for WebRTC establishment.
2. Browser creates WebRTC peer connection to OpenAI Realtime, streams mic input.
3. Realtime emits user transcription and assistant text events.
4. Assistant text is posted to `POST /api/tts/stream`.
5. The server route opens ElevenLabs **stream-input WebSocket** with `ELEVEN_API_KEY`, streams PCM audio chunks back as NDJSON.
6. Browser plays chunks via Web Audio API queue (`AudioContext`) and can stop instantly on interruption.

## Barge-in behavior

- Primary trigger: Realtime event `input_audio_buffer.speech_started`.
  - If Vocallia is speaking, playback is stopped immediately.
  - Current ElevenLabs streaming playback loop is cancelled.
- Fallback trigger: local VAD based on mic RMS energy threshold while speaking.

## Prompt behavior

Realtime session instructions enforce:

- Tunisian dialect in Arabic script.
- Natural French code-switch when needed.
- Short, conversational responses.
- No mention of being an AI.
- Test role: e-commerce order confirmation agent.
- TTS-safe style (no emojis, no long paragraphs).

## Troubleshooting

- **Mic permission denied**: allow microphone access in browser site settings and reload.
- **No sound until click**: browsers require user gesture; always click **Start** before playback.
- **No TTS audio**:
  - Verify `ELEVEN_API_KEY` + `ELEVEN_VOICE_ID`.
  - Check debug panel and terminal for route errors.
- **Realtime connection errors**:
  - Verify `OPENAI_API_KEY` and selected realtime model availability.
  - Ensure outbound network access to OpenAI and ElevenLabs endpoints.

## Security notes

- `OPENAI_API_KEY` and ElevenLabs keys are only used in server route handlers.
- Browser only receives ephemeral OpenAI session credentials for WebRTC setup.
