// A single media element streams the packaged track; no second loop can overlap it.
export class BackgroundMusic {
  constructor(element, onChange = () => {}) {
    this.element = element;
    this.onChange = onChange;
    this.enabled = false;
    this.paused = false;
    this.hidden = false;
    this.volume = 0.35;
    this.state = 'off';
    this.revision = 0;
    element.loop = true;
    element.preload = 'none';
    element.addEventListener('error', () => this.setState('error'));
    element.addEventListener('waiting', () => {
      if (this.shouldPlay) this.setState('loading');
    });
    element.addEventListener('playing', () => {
      if (this.shouldPlay) this.setState('playing');
      else element.pause();
    });
  }

  attach(context) {
    if (this.gain) return;
    this.context = context;
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    context.createMediaElementSource(this.element).connect(this.gain);
    this.gain.connect(context.destination);
  }

  get shouldPlay() {
    return this.enabled && !this.paused && !this.hidden && this.volume > 0;
  }

  setState(state) {
    if (['error', 'blocked'].includes(state)) this.failure = state;
    if (state === this.state) return;
    this.state = state;
    this.onChange(state);
  }

  sync({ retry = false } = {}) {
    const track = this.element;
    if (retry) {
      this.failure = null;
      this.revision++;
      this.pending = null;
      track.load();
    }
    if (!this.shouldPlay) {
      this.revision++;
      this.pending = null;
      track.pause();
      if (this.gain) this.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.06);
      this.setState(
        !this.enabled ? 'off' : this.failure || (this.volume === 0 ? 'silent' : 'paused'),
      );
      return Promise.resolve();
    }
    if (!this.gain) return Promise.resolve();
    this.gain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.12);
    if (this.failure) return Promise.resolve();
    if (this.pending || !track.paused) return this.pending || Promise.resolve();
    const revision = ++this.revision;
    this.setState('loading');
    this.pending = track
      .play()
      .then(() => {
        if (revision !== this.revision) return;
        if (this.shouldPlay) this.setState('playing');
        else track.pause();
      })
      .catch((error) => {
        if (revision !== this.revision) return;
        this.setState(error.name === 'NotAllowedError' ? 'blocked' : 'error');
      })
      .finally(() => {
        if (revision === this.revision) this.pending = null;
      });
    return this.pending;
  }

  snapshot() {
    return {
      state: this.state,
      volume: this.volume,
      paused: this.element.paused,
      currentTime: this.element.currentTime,
      duration: this.element.duration || 0,
      loop: this.element.loop,
      source: this.element.currentSrc,
    };
  }
}
