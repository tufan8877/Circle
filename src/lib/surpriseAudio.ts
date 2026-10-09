export class SurpriseAudio {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private loading: Promise<void> | null = null;
  private source: AudioBufferSourceNode | null = null;
  private resuming: Promise<void> | null = null;
  private silentMedia: HTMLAudioElement | null = null;
  private generation = 0;
  private lastError = '';

  unlock() {
    try {
      const session = typeof navigator !== 'undefined' ?
        (navigator as Navigator & {audioSession?: {type: string}}).audioSession : undefined;
      // iOS otherwise treats Web Audio as ambient audio, which can be silent.
      if (session) session.type = 'playback';
      else if (window.Audio) {
        // Legacy iOS fallback: activate the media channel using actual silence.
        this.silentMedia ??= new window.Audio('/audio-unlock.wav');
        this.silentMedia.loop = true;
        this.silentMedia.volume = 1;
        void this.silentMedia.play().catch(() => {});
      }
      const Constructor = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (!Constructor) return;
      this.context ??= new Constructor();
      const context = this.context;
      // Resume synchronously inside the input gesture, without awaiting loading.
      this.resuming = context.resume().catch(error => {
        this.lastError = error instanceof Error ? error.name : String(error);
        console.warn('Surprise audio resume failed', error);
      });
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
          .catch(error => {
            this.lastError = error instanceof Error ? error.message : String(error);
            console.warn('Surprise audio loading failed', error);
          })
          .finally(() => {this.loading = null;});
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.warn('Surprise audio preparation failed', error);
    }
  }

  get status() {return `${this.context?.state ?? 'unavailable'} / ${this.buffer ? 'loaded' : 'not loaded'}${this.lastError ? ` / ${this.lastError}` : ''}`;}

  async start() {
    const generation = this.generation;
    // unlock is synchronous so resume retains the original user activation.
    this.unlock();
    await Promise.all([this.resuming, this.loading]);
    if (generation !== this.generation) return false;
    return this.play();
  }

  get ready() {return this.context?.state === 'running' && this.buffer !== null;}

  play(offset = 0) {
    if (!this.ready || !this.context || !this.buffer) return false;
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.context.destination);
    source.onended = () => source.disconnect();
    source.start(0, Math.min(Math.max(0, offset), this.buffer.duration));
    this.source = source;
    return true;
  }

  stop() {
    this.generation++;
    this.silentMedia?.pause();
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
    this.silentMedia = null;
  }
}
