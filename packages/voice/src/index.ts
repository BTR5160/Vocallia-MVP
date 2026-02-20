import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

export type VoiceGenerationInput = {
  leadName: string;
  city: string;
  orderId: string;
  notes: string;
};

const outcomes = ["confirmed", "cancelled", "no_answer", "callback"] as const;

export async function generateScript(input: VoiceGenerationInput): Promise<{ transcript: string; outcome: (typeof outcomes)[number] }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const fallback = `Aaslema ${input.leadName}, houni Vocallia. Nheb n2akdou talbitek رقم ${input.orderId} l ${input.city}. ${input.notes || "Netsennaw tawjihak."}`;
    return { transcript: fallback, outcome: outcomes[Math.floor(Math.random() * outcomes.length)] };
  }

  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You generate concise Tunisian Arabic dialect call transcripts and classify outcome." },
      {
        role: "user",
        content: `Lead: ${input.leadName}, city: ${input.city}, order: ${input.orderId}, notes: ${input.notes}. Return strict JSON with fields transcript and outcome (confirmed/cancelled/no_answer/callback).`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { transcript?: string; outcome?: (typeof outcomes)[number] };
  return {
    transcript: parsed.transcript || `Aaslema ${input.leadName}, naamlou confirmation l commande ${input.orderId}.`,
    outcome: outcomes.includes(parsed.outcome as (typeof outcomes)[number]) ? (parsed.outcome as (typeof outcomes)[number]) : "confirmed",
  };
}

export async function generateElevenLabsAudio(transcript: string, outputFileName: string): Promise<string> {
  const apiKey = process.env.ELEVEN_API_KEY;
  const voiceId = process.env.ELEVEN_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
  const outputDir = path.join(process.cwd(), "apps/dashboard/public/audio");
  await mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, outputFileName);

  if (!apiKey) {
    await writeFile(outputPath, Buffer.from(""));
    return `/audio/${outputFileName}`;
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: transcript,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${await response.text()}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await writeFile(outputPath, Buffer.from(arrayBuffer));
  return `/audio/${outputFileName}`;
}
