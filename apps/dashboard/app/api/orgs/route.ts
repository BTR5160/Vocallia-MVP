import { NextResponse } from "next/server";
import { db, uid } from "@/lib/db";

export async function GET() {
  const rows = db.prepare("SELECT * FROM organizations ORDER BY created_at DESC").all();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string };
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const org = { id: uid("org"), name: body.name, created_at: new Date().toISOString() };
  db.prepare("INSERT INTO organizations (id,name,created_at) VALUES (?,?,?)").run(org.id, org.name, org.created_at);
  return NextResponse.json(org);
}
