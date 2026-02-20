# Vocallia MVP

Monorepo MVP for campaign calling simulation.

## Stack
- Turborepo + pnpm workspace
- Next.js dashboard (`apps/dashboard`)
- SQLite (`better-sqlite3`) for org/campaign/lead/call data
- `@vocallia/voice` package:
  - OpenAI (`gpt-4o-mini`) for transcript+outcome (optional)
  - ElevenLabs TTS for mp3 output (required for real audio)

## Environment variables
Create `.env.local` in `apps/dashboard`:

```bash
ELEVEN_API_KEY=...
ELEVEN_VOICE_ID=EXAVITQu4vr4xnSDxMaL # optional override
OPENAI_API_KEY=... # optional
```

If `OPENAI_API_KEY` is missing, transcript generation uses a fallback script.
If `ELEVEN_API_KEY` is missing, an empty placeholder mp3 file is written so the flow still completes locally.

## Run
```bash
pnpm install
pnpm dev
```
Open `http://localhost:3000`.

## MVP flow
1. Create an organization.
2. Create a campaign under that org.
3. Open campaign.
4. Upload CSV with headers: `name,phone,order_id,city,notes`.
5. Click **Start Campaign**.
6. Calls are queued then processed by in-process worker (`queued -> calling -> done/failed`).
7. Open call details to see transcript, outcome, and audio player.

Audio files are saved in `apps/dashboard/public/audio/<callId>.mp3`.

## Smoke test
Start dev server in one terminal, then run:

```bash
pnpm smoke
```

This script creates org/campaign, uploads sample CSV, starts campaign, and validates calls were processed.

## Troubleshooting
- **No audio generated**: set `ELEVEN_API_KEY`.
- **Calls stuck in queued**: click Start Campaign again; check server logs for TTS errors.
- **Port conflict**: adjust dashboard script port in `apps/dashboard/package.json`.
