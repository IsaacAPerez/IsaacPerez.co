/* Same-origin microphone capture; no storage, network access, or generated audio. */
class SiteVoiceRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.position = 0;
    this.port.onmessage = (event) => {
      if (event.data.type !== 'flush') return;
      this.flush();
      this.port.postMessage({ flushed: true });
    };
  }
  flush() {
    if (!this.position) return;
    const samples = this.buffer.slice(0, this.position);
    this.port.postMessage({ samples: samples.buffer }, [samples.buffer]);
    this.position = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.position++] = channel[i];
      if (this.position === this.buffer.length) this.flush();
    }
    return true;
  }
}
registerProcessor('site-voice-recorder', SiteVoiceRecorder);
