// Bounded diagnostics: no gameplay changes and no unbounded per-frame history.
export class FrameMetrics {
  constructor(capacity = 300) {
    this.samples = new Float64Array(capacity);
    this.count = 0;
    this.cursor = 0;
    this.activeFrames = 0;
    this.activeMs = 0;
  }
  record(milliseconds, active) {
    if (!active || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
    this.samples[this.cursor] = milliseconds;
    this.cursor = (this.cursor + 1) % this.samples.length;
    this.count = Math.min(this.count + 1, this.samples.length);
    this.activeFrames++;
    this.activeMs += milliseconds;
  }
  snapshot() {
    const values = Array.from(this.samples.subarray(0, this.count)).sort((a, b) => a - b);
    const percentile = p => values.length ? values[Math.ceil(values.length * p) - 1] : 0;
    return {
      samples: this.count, capacity: this.samples.length,
      activeFrames: this.activeFrames, activeSeconds: this.activeMs / 1000,
      recentFps: values.length ? 1000 * values.length / values.reduce((a, b) => a + b, 0) : 0,
      medianMs: percentile(.5), p95Ms: percentile(.95),
    };
  }
}
