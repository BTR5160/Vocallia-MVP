import { spawn } from 'node:child_process';
import process from 'node:process';
import WebSocket, { WebSocketServer } from 'ws';
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const PORT = Number(process.env.WS_PORT || 8787);
const ELEVEN_MODEL_ID = process.env.ELEVEN_MODEL_ID || 'eleven_flash_v2_5';
const ELEVEN_OUTPUT_FORMAT = process.env.ELEVEN_OUTPUT_FORMAT || 'mp3_22050_32';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
if (!process.env.ELEVEN_API_KEY) throw new Error('ELEVEN_API_KEY is required');
if (!process.env.LINT0_VOSK_MODEL_PATH) throw new Error('LINT0_VOSK_MODEL_PATH is required');

const SYSTEM_PROMPT = [
  'أنت مساعد مكالمات صوتية تونسي.',
  'احكي بالتونسي بالعربي مع شوية code-switch فرنسي خفيف وقت يلزم.',
  'جاوب في أقصى حد جملتين قصار، وسؤال واحد برك في كل دور.',
  'رجّع JSON فقط بالشكل: {"intent": string, "say": string, "slots": object}.',
].join(' ');

const wss = new WebSocketServer({ port: PORT });
console.log(`WS voice server listening on ws://localhost:${PORT}`);

wss.on('connection', (socket) => {
  const state = {
    serverTurnId: 0,
    worker: spawn('python3', ['scripts/vosk_worker.py'], { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] }),
    workerBuffer: '',
    finalResolver: null,
    ttsAbort: null,
  };

  const send = (payload) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  };

  const clearTts = () => {
    if (state.ttsAbort) {
      state.ttsAbort.abort();
      state.ttsAbort = null;
    }
  };

  const handleWorkerPayload = (payload) => {
    if (payload.type === 'partial') {
      send({ type: 'partial', text: payload.text || '' });
    } else if (payload.type === 'final') {
      if (state.finalResolver) {
        state.finalResolver((payload.text || '').trim());
        state.finalResolver = null;
      }
    } else if (payload.type === 'fatal' || payload.type === 'error') {
      send({ type: 'error', message: payload.message || 'STT worker error' });
    }
  };

  state.worker.stdout.setEncoding('utf8');
  state.worker.stdout.on('data', (chunk) => {
    state.workerBuffer += chunk;
    const lines = state.workerBuffer.split('\n');
    state.workerBuffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        handleWorkerPayload(JSON.parse(line));
      } catch {
        // ignore malformed worker output
      }
    }
  });

  state.worker.stderr.setEncoding('utf8');
  state.worker.stderr.on('data', (line) => console.error('[vosk_worker]', line.trim()));
  state.worker.on('exit', (code) => {
    if (code !== 0) send({ type: 'error', message: `STT worker exited with code ${code}` });
  });

  socket.on('message', async (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === 'audio') {
        state.worker.stdin.write(`${JSON.stringify({ type: 'audio', pcm16_base64: message.pcm16_base64 })}\n`);
        return;
      }

      if (message.type === 'reset') {
        clearTts();
        state.serverTurnId += 1;
        state.worker.stdin.write(`${JSON.stringify({ type: 'reset' })}\n`);
        return;
      }

      if (message.type === 'barge_in') {
        clearTts();
        state.serverTurnId += 1;
        send({ type: 'tts_end', turnId: state.serverTurnId });
        return;
      }

      if (message.type === 'commit') {
        const requestedTurnId = Number(message.turnId ?? 0);
        const finalText = await requestFinalTranscript(state);
        send({ type: 'final', text: finalText });

        if (!finalText) {
          send({ type: 'assistant_json', data: { intent: 'silence', say: 'ما سمعتكش واضح، تنجم تعاود؟', slots: {} } });
          return;
        }

        const assistantJson = await buildAssistantResponse(finalText);
        send({ type: 'assistant_json', data: assistantJson });

        const activeTurnId = Math.max(requestedTurnId, state.serverTurnId);
        state.serverTurnId = activeTurnId;
        await streamElevenLabsTts(assistantJson.say, activeTurnId, send, state);
        return;
      }

      send({ type: 'error', message: `Unknown message type: ${message.type}` });
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : 'Message handling failed' });
    }
  });

  socket.on('close', () => {
    clearTts();
    state.worker.kill('SIGTERM');
  });
  socket.on('error', (error) => console.error('[ws client error]', error));
});

function requestFinalTranscript(state) {
  return new Promise((resolve) => {
    state.finalResolver = resolve;
    state.worker.stdin.write(`${JSON.stringify({ type: 'commit' })}\n`);
    setTimeout(() => {
      if (state.finalResolver) {
        state.finalResolver('');
        state.finalResolver = null;
      }
    }, 4000);
  });
}

async function buildAssistantResponse(userText) {
  const requestBody = {
    model: OPENAI_MODEL,
    temperature: 0.4,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ],
    // Use json_object to avoid strict-schema validation errors on older Chat Completions models.
    response_format: { type: 'json_object' },
  };

  let response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  let data = await response.json();

  if (!response.ok) throw new Error(data?.error?.message || 'OpenAI completion failed');

  const content = data?.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content || '{}');

  return {
    intent: typeof parsed.intent === 'string' ? parsed.intent : 'unknown',
    say: typeof parsed.say === 'string' ? parsed.say : 'نجم نعاونك؟',
    slots: parsed.slots && typeof parsed.slots === 'object' ? parsed.slots : {},
  };
}

async function streamElevenLabsTts(text, turnId, send, state) {
  if (!text?.trim()) {
    send({ type: 'tts_end', turnId });
    return;
  }

  const voiceId = process.env.ELEVEN_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${encodeURIComponent(ELEVEN_MODEL_ID)}&output_format=${encodeURIComponent(ELEVEN_OUTPUT_FORMAT)}`;

  await new Promise((resolve) => {
    const abortController = new AbortController();
    state.ttsAbort = abortController;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      state.ttsAbort = null;
      send({ type: 'tts_end', turnId });
      resolve();
    };

    const ws = new WebSocket(wsUrl);
    abortController.signal.addEventListener('abort', () => {
      try { ws.close(); } catch {}
      finish();
    });

    ws.on('open', () => {
      ws.send(JSON.stringify({
        text: ' ',
        xi_api_key: process.env.ELEVEN_API_KEY,
        generation_config: { chunk_length_schedule: [80, 120, 160, 220] },
        voice_settings: { stability: 0.35, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true },
      }));
      ws.send(JSON.stringify({ text }));
      ws.send(JSON.stringify({ text: '', flush: true }));
    });

    ws.on('message', (data) => {
      if (abortController.signal.aborted) return;
      const payload = JSON.parse(data.toString());
      if (payload.audio) {
        send({ type: 'tts_chunk', turnId, audio_base64: payload.audio, mime: 'audio/mpeg' });
      }
      if (payload.isFinal) {
        ws.close();
        finish();
      }
      if (payload.message) {
        send({ type: 'error', message: payload.message });
      }
    });

    ws.on('error', (error) => {
      send({ type: 'error', message: `TTS stream error: ${error.message}` });
      finish();
    });

    ws.on('close', finish);
  });
}
