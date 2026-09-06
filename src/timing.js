// Simulation advances independently of render FPS. Limit catch-up after long stalls;
// background time is intentionally discarded because the game auto-pauses on blur.
export class FixedStepper {
  constructor() {
    this.stepSeconds = 1 / 60;
    this.accumulator = 0;
  }

  advance(elapsed, { speed = 1, paused = false }, update) {
    if (paused) {
      this.accumulator = 0;
      return 0;
    }
    const safeElapsed = Math.max(0, Math.min(Number.isFinite(elapsed) ? elapsed : 0, 0.25));
    this.accumulator += safeElapsed * speed;
    const steps = Math.min(30, Math.floor((this.accumulator + 1e-9) / this.stepSeconds));
    this.accumulator = Math.max(0, this.accumulator - steps * this.stepSeconds);
    for (let i = 0; i < steps; i++) update(this.stepSeconds);
    return steps * this.stepSeconds;
  }
}
