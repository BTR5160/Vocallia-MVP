import { db } from "./db";
import { generateElevenLabsAudio, generateScript } from "@vocallia/voice/index";

let started = false;

export function startWorker() {
  if (started) return;
  started = true;

  setInterval(async () => {
    const next = db.prepare(`SELECT c.id, l.name, l.city, l.order_id, l.notes FROM calls c JOIN leads l ON l.id = c.lead_id WHERE c.status='queued' ORDER BY c.created_at ASC LIMIT 1`).get() as
      | { id: string; name: string; city: string; order_id: string; notes: string }
      | undefined;
    if (!next) return;

    const now = new Date().toISOString();
    db.prepare(`UPDATE calls SET status='calling', updated_at=? WHERE id=?`).run(now, next.id);

    try {
      const script = await generateScript({
        leadName: next.name,
        city: next.city,
        orderId: next.order_id,
        notes: next.notes,
      });

      const audioUrl = await generateElevenLabsAudio(script.transcript, `${next.id}.mp3`);
      db.prepare(`UPDATE calls SET status='done', outcome=?, transcript=?, audio_url=?, updated_at=? WHERE id=?`).run(
        script.outcome,
        script.transcript,
        audioUrl,
        new Date().toISOString(),
        next.id,
      );
    } catch (error) {
      db.prepare(`UPDATE calls SET status='failed', error=?, updated_at=? WHERE id=?`).run(
        error instanceof Error ? error.message : String(error),
        new Date().toISOString(),
        next.id,
      );
    }
  }, 1500);
}
