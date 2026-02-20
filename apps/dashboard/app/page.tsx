"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Org = { id: string; name: string };
type Campaign = { id: string; name: string; status: string; created_at: string };

export default function DashboardPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [orgName, setOrgName] = useState("Demo Org");
  const [campaignName, setCampaignName] = useState("Ramadan Campaign");
  const [selectedOrgId, setSelectedOrgId] = useState("");

  async function loadOrgs() {
    const res = await fetch("/api/orgs");
    const data = await res.json();
    setOrgs(data);
    if (!selectedOrgId && data[0]?.id) setSelectedOrgId(data[0].id);
  }

  async function loadCampaigns(orgId: string) {
    if (!orgId) return setCampaigns([]);
    const res = await fetch(`/api/campaigns?orgId=${orgId}`);
    setCampaigns(await res.json());
  }

  useEffect(() => {
    loadOrgs();
  }, []);

  useEffect(() => {
    if (selectedOrgId) loadCampaigns(selectedOrgId);
  }, [selectedOrgId]);

  return (
    <div>
      <div className="card grid grid-2">
        <div>
          <h3>Create organization</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await fetch("/api/orgs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: orgName }),
              });
              await loadOrgs();
            }}
          >
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <button type="submit" style={{ marginLeft: 8 }}>
              Add Org
            </button>
          </form>
        </div>
        <div>
          <h3>Create campaign</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedOrgId) return;
              await fetch("/api/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId: selectedOrgId, name: campaignName }),
              });
              await loadCampaigns(selectedOrgId);
            }}
          >
            <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} style={{ marginLeft: 8 }} />
            <button type="submit" style={{ marginLeft: 8 }}>
              Add Campaign
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3>Campaigns</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td><span className="badge">{c.status}</span></td>
                <td>{new Date(c.created_at).toLocaleString()}</td>
                <td>
                  <Link href={`/campaigns/${c.id}`}>Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
