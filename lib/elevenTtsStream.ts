export type TtsChunkHandler = (chunk: string) => void;
export type TtsInterruptRef = { interrupted: boolean };

export async function streamTextToEleven(
  text: string,
  onChunk: TtsChunkHandler,
  interruptRef: TtsInterruptRef,
  onDone?: () => void,
) {
  const response = await fetch('/api/tts/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`TTS stream failed: ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';

  while (true) {
    if (interruptRef.interrupted) {
      reader.cancel();
      return;
    }

    const { done, value } = await reader.read();
    if (done) {
      onDone?.();
      return;
    }

    buffered += decoder.decode(value, { stream: true });

    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const payload = JSON.parse(line);

      if (payload.type === 'audio_chunk') {
        onChunk(payload.audio);
      }

      if (payload.type === 'done') {
        onDone?.();
        return;
      }
    }
  }
}
