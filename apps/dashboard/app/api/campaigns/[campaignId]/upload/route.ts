import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { db, uid } from "@/lib/db";
import { leadUploadSchema } from "@vocallia/shared/index";

export async function POST(request: Request, { params }: { params: { campaignId: string } }) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "CSV file missing" }, { status: 400 });

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id=?").get(params.campaignId) as { org_id: string } | undefined;
  if (!campaign) return NextResponse.json({ error: "campaign not found" }, { status: 404 });

  const text = await file.text();
  const rows = parse(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

  let imported = 0;
  for (const row of rows) {
    const parsed = leadUploadSchema.safeParse({
      name: row.name,
      phone: row.phone,
      order_id: row.order_id,
      city: row.city,
      notes: row.notes ?? "",
    });
    if (!parsed.success) continue;
    const lead = parsed.data;
    db.prepare(
      "INSERT INTO leads (id,org_id,campaign_id,name,phone,order_id,city,notes) VALUES (?,?,?,?,?,?,?,?)",
    ).run(uid("lead"), campaign.org_id, params.campaignId, lead.name, lead.phone, lead.order_id, lead.city, lead.notes);
    imported += 1;
  }

  return NextResponse.json({ imported });
}
