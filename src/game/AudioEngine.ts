export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private step = 0;
  private muted = false;

  private ensure(): AudioContext | null {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.context.destination);
    } catch {
      this.context = null;
    }
    return this.context;
  }

  unlock(): void {
    this.ensure();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.32, this.context.currentTime, 0.02);
    }
    return this.muted;
  }

  private tone(frequency: number, duration: number, type: OscillatorType = 'square', volume = 0.5, slideTo?: number): void {
    if (this.muted) return;
    const context = this.ensure();
    if (!context || !this.master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), context.currentTime + duration);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }

  private noise(duration: number, volume = 0.4, lowpass = 1200): void {
    if (this.muted) return;
    const context = this.ensure();
    if (!context || !this.master) return;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  eat(): void {
    this.tone(320 + Math.random() * 120, 0.07, 'square', 0.22, 180);
  }

  collect(): void {
    this.tone(880, 0.09, 'sine', 0.4, 1320);
    window.setTimeout(() => this.tone(1320, 0.12, 'sine', 0.32, 1760), 70);
  }

  push(): void {
    this.noise(0.12, 0.25, 500);
  }

  blocked(): void {
    this.tone(110, 0.08, 'sawtooth', 0.2, 90);
  }

  explosion(): void {
    this.noise(0.7, 0.7, 900);
    this.tone(90, 0.6, 'sawtooth', 0.5, 30);
  }

  teleport(): void {
    this.tone(300, 0.25, 'sawtooth', 0.3, 1200);
  }

  exitOpen(): void {
    [523, 659, 784, 1046].forEach((freq, i) => {
      window.setTimeout(() => this.tone(freq, 0.18, 'triangle', 0.4), i * 110);
    });
  }

  win(): void {
    [523, 659, 784, 1046, 1318].forEach((freq, i) => {
      window.setTimeout(() => this.tone(freq, 0.22, 'triangle', 0.42), i * 120);
    });
  }

  death(): void {
    this.tone(400, 0.7, 'sawtooth', 0.45, 40);
    this.noise(0.5, 0.4, 700);
  }

  click(): void {
    this.tone(660, 0.05, 'square', 0.2);
  }

  startMusic(): void {
    if (this.musicTimer !== null) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    this.musicTimer = window.setInterval(() => {
      if (this.muted) return;
      const note = bass[this.step % bass.length];
      this.tone(note, 0.22, 'triangle', 0.16);
      if (this.step % 2 === 0) this.tone(note * 4, 0.08, 'sine', 0.05);
      this.step += 1;
    }, 240);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
