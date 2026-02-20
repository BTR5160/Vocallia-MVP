"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function CampaignDetailPage({ params }: { params: { campaignId: string } }) {
  const [data, setData] = useState<any>(null);
  const [uploadResult, setUploadResult] = useState("");

  async function load() {
    const res = await fetch(`/api/campaigns/${params.campaignId}`);
    setData(await res.json());
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [params.campaignId]);

  if (!data) return <div className="card">Loading...</div>;

  return (
    <div>
      <div className="card">
        <h3>{data.campaign.name}</h3>
        <p>Status: <span className="badge">{data.campaign.status}</span></p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const res = await fetch(`/api/campaigns/${params.campaignId}/upload`, { method: "POST", body: fd });
            const result = await res.json();
            setUploadResult(`Imported ${result.imported || 0} leads`);
            await load();
          }}
        >
          <input type="file" name="file" accept=".csv" required />
          <button type="submit" style={{ marginLeft: 8 }}>Upload CSV</button>
          {uploadResult && <span style={{ marginLeft: 8 }}>{uploadResult}</span>}
        </form>
        <button
          style={{ marginTop: 12 }}
          onClick={async () => {
            await fetch(`/api/campaigns/${params.campaignId}/start`, { method: "POST" });
            await load();
          }}
        >
          Start Campaign
        </button>
      </div>

      <div className="card">
        <h4>Leads ({data.leads.length})</h4>
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Order</th><th>City</th><th>Notes</th></tr></thead>
          <tbody>
            {data.leads.map((lead: any) => (
              <tr key={lead.id}><td>{lead.name}</td><td>{lead.phone}</td><td>{lead.order_id}</td><td>{lead.city}</td><td>{lead.notes}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h4>Calls ({data.calls.length})</h4>
        <table>
          <thead><tr><th>Id</th><th>Status</th><th>Outcome</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            {data.calls.map((call: any) => (
              <tr key={call.id}>
                <td>{call.id}</td>
                <td><span className="badge">{call.status}</span></td>
                <td>{call.outcome || "-"}</td>
                <td>{new Date(call.updated_at).toLocaleTimeString()}</td>
                <td><Link href={`/calls/${call.id}`}>Details</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
