import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { callId: string } }) {
  const row = db.prepare(
    `SELECT c.*, l.name as lead_name, l.phone, l.order_id, l.city, l.notes, cp.name as campaign_name
     FROM calls c
     JOIN leads l ON l.id = c.lead_id
     JOIN campaigns cp ON cp.id = c.campaign_id
     WHERE c.id = ?`,
  ).get(params.callId);

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(row);
}
