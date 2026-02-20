import { z } from "zod";

export const leadUploadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(3),
  order_id: z.string().min(1),
  city: z.string().min(1),
  notes: z.string().default(""),
});

export type LeadUpload = z.infer<typeof leadUploadSchema>;

export const callOutcomeSchema = z.enum([
  "confirmed",
  "cancelled",
  "no_answer",
  "callback",
]);

export type CallOutcome = z.infer<typeof callOutcomeSchema>;

export type CallStatus = "queued" | "calling" | "done" | "failed";
