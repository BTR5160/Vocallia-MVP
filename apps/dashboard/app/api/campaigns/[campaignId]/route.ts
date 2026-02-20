import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { campaignId: string } }) {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id=?").get(params.campaignId);
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });
  const leads = db.prepare("SELECT * FROM leads WHERE campaign_id=? ORDER BY rowid DESC").all(params.campaignId);
  const calls = db.prepare("SELECT * FROM calls WHERE campaign_id=? ORDER BY created_at DESC").all(params.campaignId);
  return NextResponse.json({ campaign, leads, calls });
}
