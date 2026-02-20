You are Codex working inside my GitHub repo. Goal: build the first working Vocallia MVP end-to-end.

MVP scope (must be working locally):
- A web Dashboard where I can:
  1) create an Organization (tenant) and a “Campaign”
  2) upload a CSV of orders/leads (name, phone, order_id, city, notes)
  3) see a table of calls/jobs with statuses (queued, calling, done, failed)
  4) open a Call detail page and see transcript + outcome (confirmed/cancelled/no_answer/callback)
- A backend API that:
  - stores orgs, campaigns, leads, calls, transcripts
  - triggers a worker job to “simulate a call” (for now) and produces a transcript + outcome
- Voice pipeline (phase 1):
  - Implement a “voice adapter” interface with providers:
    - STT: OpenAI (optional for now, can be stubbed)
    - LLM: OpenAI chat (gpt-4o-mini)
    - TTS: ElevenLabs (must be real and generate mp3 files)
  - For now we do NOT integrate real telephony. The job should:
    1) generate a short Tunisian dialect script (LLM)
    2) generate TTS audio with ElevenLabs
    3) store transcript + audio file path/url in DB
- Multi-tenant auth:
  - Use Clerk for auth + organizations (or stub with a simple local auth if Clerk setup blocks local run)
  - All data must be scoped by orgId.

Tech stack (use these):
- TypeScript
- Turborepo + pnpm monorepo
- Next.js dashboard app
- Convex for DB + server functions (preferred). If Convex is too heavy, use Prisma + Postgres, but try Convex first.
- Tailwind + shadcn/ui for UI components
- Redis queue optional; if skipped, implement background job runner with a simple in-process queue for MVP.

Repo structure:
- apps/dashboard (Next.js)
- packages/shared (types, utils)
- packages/voice (ElevenLabs + OpenAI adapters)
- convex/ (schema + functions) OR backend/ (if not using Convex)

Environment variables:
- ELEVEN_API_KEY (required for TTS)
- OPENAI_API_KEY (optional but supported)
- Any Convex/Clerk variables required

Acceptance criteria:
1) `pnpm install` then `pnpm dev` starts the dashboard.
2) I can upload a CSV and see leads appear in the UI.
3) Clicking “Start Campaign” creates call jobs.
4) Jobs complete and generate `output.mp3` (or per-call mp3) using ElevenLabs API.
5) Call detail page shows transcript + outcome + a playable audio element.

Implementation instructions:
- Start by scaffolding the monorepo (turborepo + pnpm).
- Build the DB schema first (orgs, campaigns, leads, calls, transcripts).
- Build minimal UI screens (Campaign list, Campaign detail with leads table, Calls list, Call detail).
- Implement voice package with an ElevenLabs TTS client and a small helper to write mp3 files to a local folder (e.g., /public/audio or /tmp then copied).
- Add a README with exact run steps and troubleshooting notes.
- Add basic type-safe CSV parsing and validation.
- Add at least 1 minimal test or smoke script (e.g., upload sample CSV then run one job).

Make high-confidence changes only. Keep code clean and readable. Create small commits (or a single PR) with a clear description of what was built and how to run it.
