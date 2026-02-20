import { NextResponse } from "next/server";
import { db, uid } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
  const rows = db.prepare("SELECT * FROM campaigns WHERE org_id = ? ORDER BY created_at DESC").all(orgId);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { orgId?: string; name?: string };
  if (!body.orgId || !body.name) return NextResponse.json({ error: "orgId and name required" }, { status: 400 });

  const campaign = {
    id: uid("cmp"),
    org_id: body.orgId,
    name: body.name,
    status: "draft",
    created_at: new Date().toISOString(),
  };
  db.prepare("INSERT INTO campaigns (id,org_id,name,status,created_at) VALUES (?,?,?,?,?)").run(
    campaign.id,
    campaign.org_id,
    campaign.name,
    campaign.status,
    campaign.created_at,
  );
  return NextResponse.json(campaign);
}
