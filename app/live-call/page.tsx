'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type TranscriptLine = {
  id: string;
  speaker: 'Client' | 'Vocallia';
  text: string;
  kind: 'partial' | 'final';
};

type AssistantJson = {
  intent: string;
  say: string;
  slots: Record<string, unknown>;
};

class StreamAudioPlayer {
  private context = new AudioContext();
  private nextStart = 0;
  private active = new Set<AudioBufferSourceNode>();
  private generation = 0;

  async resume() {
    if (this.context.state !== 'running') await this.context.resume();
  }

  stopAll() {
    this.generation += 1;
    for (const source of this.active) source.stop();
    this.active.clear();
    this.nextStart = this.context.currentTime;
  }

  async playMp3Chunk(base64Audio: string, turnId: number, currentTurnRef: { current: number }) {
    const generationAtQueue = this.generation;
    const bytes = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
    const buffer = await this.context.decodeAudioData(bytes.buffer.slice(0));

    if (generationAtQueue !== this.generation) return;
    if (turnId !== currentTurnRef.current) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    const startAt = Math.max(this.context.currentTime + 0.01, this.nextStart);
    source.start(startAt);
    this.nextStart = startAt + buffer.duration;

    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
    };
  }

  async close() {
    this.stopAll();
    await this.context.close();
  }
}

export default function LiveCallPage() {
  const [started, setStarted] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<'idle' | 'listening' | 'speaking'>('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const vadSilenceTimerRef = useRef<number | null>(null);
  const userSpeakingRef = useRef(false);

  const turnIdRef = useRef(0);
  const seqRef = useRef(0);
  const playerRef = useRef<StreamAudioPlayer | null>(null);

  const wsUrl = useMemo(() => process.env.NEXT_PUBLIC_VOICE_WS_URL || 'ws://localhost:8787', []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const stopPlaybackAndBargeIn = () => {
    playerRef.current?.stopAll();
    wsRef.current?.send(JSON.stringify({ type: 'barge_in', turnId: turnIdRef.current }));
    turnIdRef.current += 1;
    setStatus('listening');
  };

  const sendCommit = () => {
    wsRef.current?.send(JSON.stringify({ type: 'commit', turnId: turnIdRef.current }));
  };

  const setupAudioCapture = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        sampleSize: 16,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    streamRef.current = stream;

    const context = new AudioContext();
    audioContextRef.current = context;

    const source = context.createMediaStreamSource(stream);
    sourceRef.current = source;

    const processor = context.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    source.connect(processor);
    processor.connect(context.destination);

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);

      let energy = 0;
      for (let i = 0; i < input.length; i += 1) {
        const v = input[i];
        energy += v * v;
      }
      const rms = Math.sqrt(energy / input.length);
      const speaking = rms > 0.02;

      if (speaking && !userSpeakingRef.current) {
        userSpeakingRef.current = true;
        if (statusRef.current === 'speaking') {
          stopPlaybackAndBargeIn();
        }
      }

      if (speaking) {
        if (vadSilenceTimerRef.current) {
          window.clearTimeout(vadSilenceTimerRef.current);
          vadSilenceTimerRef.current = null;
        }
      } else if (userSpeakingRef.current && !vadSilenceTimerRef.current) {
        vadSilenceTimerRef.current = window.setTimeout(() => {
          userSpeakingRef.current = false;
          sendCommit();
          vadSilenceTimerRef.current = null;
        }, 350);
      }

      const pcm = floatTo16BitPCM(input, context.sampleRate, 16000);
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'audio',
          turnId: turnIdRef.current,
          seq: seqRef.current++,
          pcm16_base64: arrayBufferToBase64(pcm.buffer),
        }),
      );
    };
  };

  const start = async () => {
    try {
      setError(null);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      playerRef.current = new StreamAudioPlayer();
      await playerRef.current.resume();

      ws.onopen = () => setStatus('listening');

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data as string) as
          | { type: 'partial'; text: string }
          | { type: 'final'; text: string }
          | { type: 'assistant_json'; data: AssistantJson }
          | { type: 'tts_chunk'; turnId: number; audio_base64: string; mime: string }
          | { type: 'tts_end'; turnId: number }
          | { type: 'error'; message: string };

        if (msg.type === 'partial') {
          setPartialText(msg.text || '');
        }

        if (msg.type === 'final') {
          if (msg.text?.trim()) {
            setTranscript((prev) => [
              ...prev,
              { id: crypto.randomUUID(), speaker: 'Client', text: msg.text.trim(), kind: 'final' },
            ]);
          }
          setPartialText('');
          setStatus('listening');
        }

        if (msg.type === 'assistant_json') {
          setTranscript((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              speaker: 'Vocallia',
              text: `${msg.data.say}  [intent: ${msg.data.intent}]`,
              kind: 'final',
            },
          ]);
          setStatus('speaking');
        }

        if (msg.type === 'tts_chunk') {
          if (msg.turnId !== turnIdRef.current) return;
          await playerRef.current?.playMp3Chunk(msg.audio_base64, msg.turnId, turnIdRef);
        }

        if (msg.type === 'tts_end') {
          if (msg.turnId === turnIdRef.current) {
            setStatus('listening');
          }
        }

        if (msg.type === 'error') {
          setError(msg.message);
        }
      };

      ws.onerror = () => setError('WebSocket connection failed');
      ws.onclose = () => {
        setStatus('idle');
      };

      await setupAudioCapture();
      setStarted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
      await stop();
    }
  };

  const stop = async () => {
    if (vadSilenceTimerRef.current) {
      window.clearTimeout(vadSilenceTimerRef.current);
      vadSilenceTimerRef.current = null;
    }

    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    await audioContextRef.current?.close();
    audioContextRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    wsRef.current?.send(JSON.stringify({ type: 'reset' }));
    wsRef.current?.close();
    wsRef.current = null;

    await playerRef.current?.close();
    playerRef.current = null;

    setStarted(false);
    setStatus('idle');
    setPartialText('');
  };

  return (
    <main>
      <h1>Live Call Test</h1>
      <p>Browser mic → local Vosk STT → OpenAI JSON turn → ElevenLabs streamed TTS with barge-in.</p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <button disabled={started} onClick={() => void start()}>
          Start
        </button>
        <button disabled={!started} onClick={() => void stop()}>
          Stop
        </button>
        <span className="badge">{status}</span>
      </div>

      {error ? <p style={{ color: '#ff8080' }}>Error: {error}</p> : null}

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>Transcript</h2>
        <div className="transcript">
          {transcript.map((line) => (
            <div key={line.id}>
              <strong>{line.speaker}:</strong> {line.text}
            </div>
          ))}
          {partialText ? (
            <div style={{ opacity: 0.75 }}>
              <strong>Client (partial):</strong> {partialText}
            </div>
          ) : null}
          {transcript.length === 0 && !partialText ? <p style={{ opacity: 0.7 }}>No speech captured yet.</p> : null}
        </div>
      </section>
    </main>
  );
}

function floatTo16BitPCM(input: Float32Array, inSampleRate: number, outSampleRate: number) {
  if (inSampleRate === outSampleRate) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  const ratio = inSampleRate / outSampleRate;
  const outLength = Math.round(input.length / ratio);
  const output = new Int16Array(outLength);
  let offset = 0;

  for (let i = 0; i < outLength; i += 1) {
    const nextOffset = Math.round((i + 1) * ratio);
    let accum = 0;
    let count = 0;

    for (let j = offset; j < nextOffset && j < input.length; j += 1) {
      accum += input[j];
      count += 1;
    }

    const avg = count > 0 ? accum / count : 0;
    const s = Math.max(-1, Math.min(1, avg));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    offset = nextOffset;
  }

  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
