import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const rows = db.prepare(
    `SELECT c.*, l.name as lead_name, l.phone, l.order_id, cp.name as campaign_name
     FROM calls c
     JOIN leads l ON l.id = c.lead_id
     JOIN campaigns cp ON cp.id = c.campaign_id
     WHERE c.org_id = ?
     ORDER BY c.created_at DESC`,
  ).all(orgId);
  return NextResponse.json(rows);
}
