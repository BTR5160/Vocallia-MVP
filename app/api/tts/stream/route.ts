import { NextRequest, NextResponse } from 'next/server';
import WebSocket from 'ws';

export const runtime = 'nodejs';

const DEFAULT_MODEL = 'eleven_flash_v2_5';

export async function POST(request: NextRequest) {
  if (!process.env.ELEVEN_API_KEY || !process.env.ELEVEN_VOICE_ID) {
    return NextResponse.json({ error: 'Missing ElevenLabs environment variables' }, { status: 500 });
  }

  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: 'Missing text for TTS' }, { status: 400 });
  }

  const modelId = process.env.ELEVEN_MODEL_ID ?? DEFAULT_MODEL;
  const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_VOICE_ID}/stream-input?model_id=${encodeURIComponent(modelId)}&output_format=pcm_16000`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const ws = new WebSocket(wsUrl);

      const closeWithError = (error: string) => {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'error', error })}\n`));
        controller.close();
      };

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            text: ' ',
            xi_api_key: process.env.ELEVEN_API_KEY,
            voice_settings: {
              stability: 0.35,
              similarity_boost: 0.75,
              style: 0.15,
              use_speaker_boost: true,
            },
            generation_config: {
              chunk_length_schedule: [100, 140, 180, 220],
            },
          }),
        );

        ws.send(JSON.stringify({ text }));
        ws.send(JSON.stringify({ text: '', flush: true }));
      });

      ws.on('message', (data) => {
        const parsed = JSON.parse(data.toString()) as {
          audio?: string;
          isFinal?: boolean;
          message?: string;
        };

        if (parsed.audio) {
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'audio_chunk', audio: parsed.audio })}\n`));
        }

        if (parsed.isFinal) {
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'done' })}\n`));
          controller.close();
          ws.close();
        }

        if (parsed.message) {
          closeWithError(parsed.message);
        }
      });

      ws.on('error', (error) => {
        closeWithError(error.message);
      });

      ws.on('close', () => {
        try {
          controller.close();
        } catch {
          // no-op when already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
