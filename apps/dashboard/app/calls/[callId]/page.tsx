"use client";

import { useEffect, useState } from "react";

export default function CallDetailPage({ params }: { params: { callId: string } }) {
  const [call, setCall] = useState<any>(null);

  async function load() {
    const res = await fetch(`/api/calls/${params.callId}`);
    setCall(await res.json());
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [params.callId]);

  if (!call) return <div className="card">Loading...</div>;

  return (
    <div className="card">
      <h3>Call {call.id}</h3>
      <p>Campaign: {call.campaign_name}</p>
      <p>Lead: {call.lead_name} ({call.phone})</p>
      <p>Status: <span className="badge">{call.status}</span></p>
      <p>Outcome: {call.outcome || "-"}</p>
      <p><strong>Transcript</strong></p>
      <pre style={{ whiteSpace: "pre-wrap", background: "#f3f4f6", padding: 12, borderRadius: 8 }}>{call.transcript || "No transcript yet"}</pre>
      {call.audio_url ? (
        <audio controls src={call.audio_url} style={{ width: "100%", marginTop: 10 }} />
      ) : (
        <p>No audio yet.</p>
      )}
      {call.error && <p style={{ color: "red" }}>Error: {call.error}</p>}
    </div>
  );
}
