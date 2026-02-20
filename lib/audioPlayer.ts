export class AudioPlayer {
  private audioContext: AudioContext;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();

  constructor() {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
  }

  async resume() {
    if (this.audioContext.state !== 'running') {
      await this.audioContext.resume();
    }
  }

  playPcm16Chunk(base64Pcm: string, sampleRate = 16000) {
    const binary = atob(base64Pcm);
    const view = new DataView(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i += 1) {
      view.setUint8(i, binary.charCodeAt(i));
    }

    const frameCount = binary.length / 2;
    const audioBuffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
    const channel = audioBuffer.getChannelData(0);

    for (let i = 0; i < frameCount; i += 1) {
      const int16 = view.getInt16(i * 2, true);
      channel[i] = int16 / 32768;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const startAt = Math.max(this.audioContext.currentTime + 0.01, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + audioBuffer.duration;

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
    };
  }

  stopAll() {
    for (const source of this.activeSources) {
      source.stop();
    }
    this.activeSources.clear();
    this.nextStartTime = this.audioContext.currentTime;
  }

  async close() {
    this.stopAll();
    await this.audioContext.close();
  }
}
