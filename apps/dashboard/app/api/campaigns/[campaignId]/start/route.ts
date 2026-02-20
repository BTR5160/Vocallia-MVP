import { NextResponse } from "next/server";
import { db, uid } from "@/lib/db";
import { startWorker } from "@/lib/queue";

export async function POST(_: Request, { params }: { params: { campaignId: string } }) {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id=?").get(params.campaignId) as { org_id: string } | undefined;
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });

  const leads = db.prepare("SELECT id FROM leads WHERE campaign_id=?").all(params.campaignId) as { id: string }[];
  const now = new Date().toISOString();

  const insert = db.prepare(
    "INSERT INTO calls (id,org_id,campaign_id,lead_id,status,outcome,transcript,audio_url,error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
  );
  for (const lead of leads) {
    const existing = db.prepare("SELECT id FROM calls WHERE lead_id=? AND campaign_id=?").get(lead.id, params.campaignId);
    if (existing) continue;
    insert.run(uid("call"), campaign.org_id, params.campaignId, lead.id, "queued", null, null, null, null, now, now);
  }

  db.prepare("UPDATE campaigns SET status='running' WHERE id=?").run(params.campaignId);
  startWorker();

  return NextResponse.json({ queued: true, leads: leads.length });
}
