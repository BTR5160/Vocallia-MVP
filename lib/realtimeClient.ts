export type RealtimeEventHandler = (event: any) => void;

export class RealtimeClient {
  private peerConnection?: RTCPeerConnection;
  private dataChannel?: RTCDataChannel;
  private localStream?: MediaStream;

  async connect(onEvent: RealtimeEventHandler) {
    const sessionResponse = await fetch('/api/realtime/session', { method: 'POST' });
    const sessionData = await sessionResponse.json();

    if (!sessionResponse.ok) {
      const errorMessage = sessionData?.details?.error?.message ?? sessionData?.error ?? 'Failed to create realtime session';
      throw new Error(errorMessage);
    }
    const ephemeralKey =
      sessionData?.client_secret?.value ?? sessionData?.ephemeral_key ?? sessionData?.token;

    if (!ephemeralKey) {
      throw new Error('No ephemeral key returned from server');
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const pc = new RTCPeerConnection();
    this.peerConnection = pc;

    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream);
    }

    const dc = pc.createDataChannel('oai-events');
    this.dataChannel = dc;

    dc.addEventListener('message', (message) => {
      try {
        onEvent(JSON.parse(message.data));
      } catch {
        onEvent({ type: 'raw', data: message.data });
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const model = sessionData?.model ?? 'gpt-realtime';
    const baseUrl = process.env.NEXT_PUBLIC_OPENAI_REALTIME_URL ?? 'https://api.openai.com/v1/realtime';

    const sdpResponse = await fetch(`${baseUrl}?model=${encodeURIComponent(model)}`, {
      method: 'POST',
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        'Content-Type': 'application/sdp',
      },
    });

    if (!sdpResponse.ok) {
      throw new Error(`Failed to establish realtime WebRTC: ${await sdpResponse.text()}`);
    }

    const answerSdp = await sdpResponse.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    return this.localStream;
  }

  sendEvent(payload: Record<string, unknown>) {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(payload));
    }
  }

  close() {
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.localStream?.getTracks().forEach((track) => track.stop());
  }
}
