import fs from "node:fs";

const base = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  const orgRes = await fetch(`${base}/api/orgs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Smoke Org" }),
  });
  const org = await orgRes.json() as { id: string };

  const campaignRes = await fetch(`${base}/api/campaigns`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orgId: org.id, name: "Smoke Campaign" }),
  });
  const campaign = await campaignRes.json() as { id: string };

  const form = new FormData();
  const csv = fs.readFileSync(new URL("./sample.csv", import.meta.url));
  form.set("file", new Blob([csv], { type: "text/csv" }), "sample.csv");

  await fetch(`${base}/api/campaigns/${campaign.id}/upload`, { method: "POST", body: form });
  await fetch(`${base}/api/campaigns/${campaign.id}/start`, { method: "POST" });

  await new Promise((r) => setTimeout(r, 4000));
  const detail = await fetch(`${base}/api/campaigns/${campaign.id}`).then((r) => r.json()) as { calls: Array<{ status: string }> };

  const doneOrFailed = detail.calls.every((c) => c.status === "done" || c.status === "failed");
  if (!doneOrFailed || detail.calls.length === 0) {
    throw new Error("Smoke failed: calls not processed");
  }

  console.log(`Smoke success: ${detail.calls.length} calls processed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
