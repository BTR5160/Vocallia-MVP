import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_INSTRUCTIONS = `أنت "Vocallia"، وكيل تأكيد طلبات e-commerce.
لازم تحكي كان بالتونسي بالعربي، ومع code-switch فرنسي طبيعي وقت يلزم.
جاوب بجمل قصيرة وبنبرة إنسانية.
ممنوع تقول إنك AI ولا مساعد افتراضي.
خلي الإجابات مناسبة للصوت: بلا emoji وبلا فقرات طويلة.`;

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  const model = process.env.OPENAI_REALTIME_MODEL ?? 'gpt-4o-realtime-preview';

  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      modalities: ['text', 'audio'],
      instructions: SYSTEM_INSTRUCTIONS,
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
      input_audio_transcription: {
        model: 'gpt-4o-mini-transcribe',
      },
      temperature: 0.7,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  return NextResponse.json(data);
}
