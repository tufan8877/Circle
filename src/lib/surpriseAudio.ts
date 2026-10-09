export class SurpriseAudio {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private loading: Promise<void> | null = null;
  private source: AudioBufferSourceNode | null = null;

  unlock() {
    try {
      const Constructor = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (!Constructor) return;
      this.context ??= new Constructor();
      const context = this.context;
      // Resume synchronously inside the input gesture, without awaiting loading.
      void context.resume().catch(error => console.warn('Surprise audio resume failed', error));
      const silent = context.createBufferSource();
      silent.buffer = context.createBuffer(1, 1, context.sampleRate);
      silent.connect(context.destination);
      silent.onended = () => silent.disconnect();
      silent.start();
      if (!this.buffer && !this.loading) {
        this.loading = fetch('/scary-audio.wav')
          .then(response => {
            if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
            return response.arrayBuffer();
          })
          .then(data => context.decodeAudioData(data))
          .then(buffer => {this.buffer = buffer;})
          .catch(error => console.warn('Surprise audio loading failed', error))
          .finally(() => {this.loading = null;});
      }
    } catch (error) {console.warn('Surprise audio preparation failed', error);}
  }

  get ready() {return this.context?.state === 'running' && this.buffer !== null;}

  play(offset = 0) {
    if (!this.ready || !this.context || !this.buffer) return false;
    this.stop();
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.context.destination);
    source.onended = () => source.disconnect();
    source.start(0, Math.min(Math.max(0, offset), this.buffer.duration));
    this.source = source;
    return true;
  }

  stop() {
    if (!this.source) return;
    this.source.stop();
    this.source.disconnect();
    this.source = null;
  }

  dispose() {
    this.stop();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.buffer = null;
  }
}
