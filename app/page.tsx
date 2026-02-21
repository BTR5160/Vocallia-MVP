'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioPlayer } from '@/lib/audioPlayer';
import { RealtimeClient } from '@/lib/realtimeClient';
import { streamTextToEleven, TtsInterruptRef } from '@/lib/elevenTtsStream';

type TranscriptLine = {
  id: string;
  speaker: 'Client' | 'Vocallia';
  text: string;
};

export default function Home() {
  const realtimeRef = useRef<RealtimeClient | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const interruptRef = useRef<TtsInterruptRef>({ interrupted: false });
  const vadTimerRef = useRef<number | null>(null);
  const vadContextRef = useRef<AudioContext | null>(null);
  const statusRef = useRef<'idle' | 'listening' | 'speaking' | 'interrupted'>('idle');

  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking' | 'interrupted'>('idle');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [debug, setDebug] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const badgeColor = useMemo(() => {
    if (status === 'listening') return '#2dbf78';
    if (status === 'speaking') return '#7f63ff';
    if (status === 'interrupted') return '#ff8f50';
    return '#4f5f9b';
  }, [status]);

  const pushDebug = (line: string) => {
    setDebug((prev) => [new Date().toISOString().slice(11, 23) + ' ' + line, ...prev].slice(0, 40));
  };

  const interruptPlayback = () => {
    interruptRef.current.interrupted = true;
    playerRef.current?.stopAll();
    setStatus('interrupted');
    pushDebug('Playback interrupted (barge-in).');
  };

  const setupLocalVadFallback = (stream: MediaStream) => {
    const audioCtx = new AudioContext();
    vadContextRef.current = audioCtx;
    const src = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const loop = () => {
      analyser.getByteTimeDomainData(buffer);
      let energy = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const centered = (buffer[i] - 128) / 128;
        energy += centered * centered;
      }
      const rms = Math.sqrt(energy / buffer.length);

      if (rms > 0.04 && statusRef.current === 'speaking') {
        interruptPlayback();
      }

      vadTimerRef.current = window.setTimeout(loop, 100);
    };

    loop();
  };

  const handleRealtimeEvent = async (event: any) => {
    pushDebug(event.type ?? 'unknown_event');

    if (event.type === 'input_audio_buffer.speech_started') {
      if (statusRef.current === 'speaking') {
        interruptPlayback();
      }
      setStatus('listening');
    }

    if (
      event.type === 'conversation.item.input_audio_transcription.completed' ||
      event.type === 'input_audio_transcription.completed'
    ) {
      const text = event.transcript ?? event.item?.content?.[0]?.transcript;
      if (text) {
        setTranscript((prev) => [...prev, { id: crypto.randomUUID(), speaker: 'Client', text }]);
      }
      setStatus('listening');
    }

    if (event.type === 'response.done') {
      const text =
        event.response?.output?.flatMap((o: any) => o.content ?? []).find((c: any) => c.type === 'output_text')
          ?.text ?? event.response?.output_text;

      if (text && text.trim()) {
        setTranscript((prev) => [...prev, { id: crypto.randomUUID(), speaker: 'Vocallia', text }]);

        interruptRef.current.interrupted = false;
        setStatus('speaking');

        await streamTextToEleven(
          text,
          (audioChunk) => {
            if (!interruptRef.current.interrupted) {
              playerRef.current?.playPcm16Chunk(audioChunk);
            }
          },
          interruptRef.current,
          () => {
            if (statusRef.current !== 'interrupted') {
              setStatus('listening');
            }
          },
        );
      }
    }
  };

  const start = async () => {
    try {
      playerRef.current = new AudioPlayer();
      await playerRef.current.resume();

      realtimeRef.current = new RealtimeClient();
      const stream = await realtimeRef.current.connect(handleRealtimeEvent);
      setupLocalVadFallback(stream);

      setStarted(true);
      setStatus('listening');
      pushDebug('Realtime started.');
    } catch (error) {
      realtimeRef.current?.close();
      realtimeRef.current = null;

      await playerRef.current?.close();
      playerRef.current = null;

      setStarted(false);
      setStatus('idle');
      pushDebug(`Start failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const stop = async () => {
    if (vadTimerRef.current) {
      window.clearTimeout(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    await vadContextRef.current?.close();
    vadContextRef.current = null;

    realtimeRef.current?.close();
    realtimeRef.current = null;

    await playerRef.current?.close();
    playerRef.current = null;

    setStarted(false);
    setStatus('idle');
    pushDebug('Stopped.');
  };

  return (
    <main>
      <h1>Vocallia Realtime Voice MVP</h1>
      <p>Browser-based realtime Tunisian order confirmation agent with ElevenLabs TTS + barge-in.</p>

      <button onClick={() => void (started ? stop() : start())}>{started ? 'Stop' : 'Start'}</button>

      <div style={{ marginTop: '1rem' }}>
        <span className="badge" style={{ background: badgeColor }}>
          {status === 'idle' ? 'Idle' : status[0].toUpperCase() + status.slice(1)}
        </span>
      </div>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>Transcript</h2>
        <div className="transcript">
          {transcript.map((line) => (
            <div key={line.id}>
              <strong>{line.speaker}:</strong> {line.text}
            </div>
          ))}
          {transcript.length === 0 && <p style={{ opacity: 0.7 }}>No speech captured yet.</p>}
        </div>
      </section>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
          Show debug events
        </label>
        {showDebug && (
          <pre style={{ maxHeight: 220, overflowY: 'auto', opacity: 0.9 }}>{debug.join('\n')}</pre>
        )}
      </section>
    </main>
  );
}
