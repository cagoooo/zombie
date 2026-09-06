export class GameAudio {
  constructor() {
    this.enabled = false;
    this.volume = 0.45;
    this.ambience = 0.2;
    this.context = null;
    this.paused = false;
  }

  async enable(value) {
    this.enabled = value;
    if (value) {
      try {
        this.context ??= new (window.AudioContext || window.webkitAudioContext)();
        await this.context.resume();
        if (!this.ambientGain) {
          this.ambientGain = this.context.createGain();
          this.ambientGain.connect(this.context.destination);
          for (const frequency of [55, 82.4]) {
            const oscillator = this.context.createOscillator();
            oscillator.frequency.value = frequency;
            oscillator.connect(this.ambientGain);
            oscillator.start();
          }
        }
      } catch {
        this.enabled = false;
      }
    }
    this.syncAmbient();
    return this.enabled;
  }

  syncAmbient() {
    if (!this.context || !this.ambientGain) return;
    this.ambientGain.gain.setTargetAtTime(
      this.enabled && !this.paused ? this.ambience * 0.016 : 0,
      this.context.currentTime,
      0.08,
    );
  }

  setPaused(paused) {
    this.paused = paused;
    this.syncAmbient();
  }

  tone(frequency, end, duration, type = 'sine', gain = 0.045, delay = 0) {
    if (!this.enabled || !this.context || this.paused) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator(),
      envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    envelope.gain.setValueAtTime(Math.max(0.0001, gain * this.volume), now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  }

  play(type) {
    if (type === 'pulse') this.tone(760, 95, 0.12, 'square', 0.024);
    else if (type === 'plasma') {
      this.tone(170, 28, 0.32, 'sawtooth', 0.055);
      this.tone(80, 35, 0.3, 'sine', 0.08);
    } else if (type === 'cryo') this.tone(1500, 570, 0.1, 'triangle', 0.032);
    else if (type === 'step') this.tone(110, 40, 0.055, 'triangle', 0.018);
    else if (type === 'hit') this.tone(950, 650, 0.04, 'sine', 0.015);
    else if (type === 'kill') this.tone(580, 1100, 0.12, 'sine', 0.023);
    else if (type === 'breach') {
      this.tone(240, 160, 0.25, 'triangle', 0.05);
      this.tone(240, 160, 0.25, 'triangle', 0.05, 0.3);
    } else if (type === 'wave') {
      this.tone(330, 440, 0.2, 'sine');
      this.tone(440, 550, 0.2, 'sine', 0.045, 0.22);
    } else if (type === 'build') this.tone(300, 780, 0.18, 'sine');
  }
}
