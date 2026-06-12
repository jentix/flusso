export type AudioSourceKind = 'none' | 'mic' | 'file';

/**
 * Wraps WebAudio: one AudioContext + AnalyserNode shared by the whole graph.
 * Context is created lazily and must be resumed from a user gesture
 * (browser autoplay policy) — the TopBar "Enable audio" button does this.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  /** All sources route through this gain — `level` 0..1 scales the signal before analysis. */
  private gain: GainNode | null = null;
  private outputConnected = false;
  private currentSource: AudioNode | null = null;
  private fileBufferSource: AudioBufferSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private byteBuffer: Uint8Array<ArrayBuffer> = new Uint8Array(0);

  sourceKind: AudioSourceKind = 'none';
  lastError: string | null = null;

  get binCount(): number {
    return this.analyser?.frequencyBinCount ?? 0;
  }

  get isActive(): boolean {
    return this.sourceKind !== 'none' && this.ctx?.state === 'running';
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      this.gain = this.ctx.createGain();
      this.gain.connect(this.analyser);
      this.byteBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    }
    return this.ctx;
  }

  private detachSource(): void {
    this.fileBufferSource?.stop();
    this.fileBufferSource = null;
    this.currentSource?.disconnect();
    this.currentSource = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    if (this.outputConnected && this.analyser) {
      this.analyser.disconnect(); // stop routing file playback to speakers
      this.outputConnected = false;
    }
    this.sourceKind = 'none';
  }

  async useMic(): Promise<void> {
    const ctx = this.ensureContext();
    await ctx.resume();
    this.detachSource();
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = ctx.createMediaStreamSource(this.micStream);
      src.connect(this.gain!);
      this.currentSource = src;
      this.sourceKind = 'mic';
      this.lastError = null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async useFile(file: File): Promise<void> {
    const ctx = this.ensureContext();
    await ctx.resume();
    this.detachSource();
    try {
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this.gain!);
      this.analyser!.connect(ctx.destination); // hear file playback (post-gain)
      this.outputConnected = true;
      src.start();
      this.fileBufferSource = src;
      this.currentSource = src;
      this.sourceKind = 'file';
      this.lastError = null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  stop(): void {
    this.detachSource();
  }

  /**
   * Signal multiplier 0..1: scales what the analyser sees (and file playback
   * volume). 0 = no output signal, 1 = full.
   */
  setLevel(level: number): void {
    if (this.gain) this.gain.gain.value = Math.min(1, Math.max(0, level));
  }

  /**
   * Pause/resume. File: playbackRate 0 freezes playback in place.
   * Mic: disables the stream's tracks.
   */
  setPlaying(playing: boolean): void {
    if (this.fileBufferSource) this.fileBufferSource.playbackRate.value = playing ? 1 : 0;
    this.micStream?.getTracks().forEach((t) => (t.enabled = playing));
  }

  /** Read current spectrum into `out` (0..1 per bin). Reuses internal byte buffer. */
  getSpectrum(out: Float32Array): void {
    if (!this.analyser) {
      out.fill(0);
      return;
    }
    this.analyser.getByteFrequencyData(this.byteBuffer);
    const n = Math.min(out.length, this.byteBuffer.length);
    for (let i = 0; i < n; i++) out[i] = this.byteBuffer[i] / 255;
  }

  dispose(): void {
    this.detachSource();
    this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
  }
}
