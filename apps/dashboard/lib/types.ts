export type Organization = { id: string; name: string; created_at: string };
export type Campaign = { id: string; org_id: string; name: string; status: string; created_at: string };
export type Lead = {
  id: string;
  org_id: string;
  campaign_id: string;
  name: string;
  phone: string;
  order_id: string;
  city: string;
  notes: string;
};
export type Call = {
  id: string;
  org_id: string;
  campaign_id: string;
  lead_id: string;
  status: string;
  outcome: string | null;
  transcript: string | null;
  audio_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};
