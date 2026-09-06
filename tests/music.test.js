import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BackgroundMusic } from '../src/music.js';

function setup(play) {
  const element = {
    paused: true,
    currentTime: 0,
    duration: 56.87,
    events: {},
    addEventListener(name, fn) {
      this.events[name] = fn;
    },
    pause() {
      this.paused = true;
    },
    load() {
      this.paused = true;
      this.loads = (this.loads || 0) + 1;
    },
    play() {
      this.calls = (this.calls || 0) + 1;
      this.paused = false;
      return play?.() || Promise.resolve();
    },
  };
  const music = new BackgroundMusic(element);
  const context = {
    currentTime: 0,
    destination: {},
    createGain: () => ({ gain: { value: 0, setTargetAtTime() {} }, connect() {} }),
    createMediaElementSource: () => ({ connect() {} }),
  };
  music.attach(context);
  music.enabled = true;
  return { music, element };
}
test('repeated sync shares one playback; mute, pause, hidden and zero volume stop it', async () => {
  const { music, element } = setup();
  await music.sync();
  await music.sync();
  assert.equal(element.calls, 1);
  assert.equal(element.loop, true);
  for (const key of ['paused', 'hidden']) {
    music[key] = true;
    await music.sync();
    assert.equal(element.paused, true);
    music[key] = false;
    await music.sync();
    assert.equal(element.paused, false);
  }
  music.volume = 0;
  await music.sync();
  assert.equal(music.state, 'silent');
  music.volume = 0.25;
  await music.sync();
  assert.equal(element.paused, false);
  music.enabled = false;
  await music.sync();
  assert.equal(element.paused, true);
});
test('late play promise cannot undo a newer pause or playback state', async () => {
  let resolve;
  const { music, element } = setup(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const playing = music.sync();
  music.paused = true;
  await music.sync();
  resolve();
  await playing;
  assert.equal(element.paused, true);
  assert.equal(music.state, 'paused');
});
test('network failure stays visible through settings pause and retries explicitly', async () => {
  let fail = true;
  const { music, element } = setup(() =>
    fail ? Promise.reject(new Error('network')) : Promise.resolve(),
  );
  await music.sync();
  assert.equal(music.state, 'error');
  music.paused = true;
  await music.sync();
  assert.equal(music.state, 'error');
  fail = false;
  await music.sync({ retry: true });
  assert.equal(music.state, 'paused');
  music.paused = false;
  await music.sync();
  assert.equal(music.state, 'playing');
  assert.equal(element.loads, 1);
});
test('autoplay rejection provides recoverable blocked state without unhandled rejection', async () => {
  const { music } = setup(() =>
    Promise.reject(Object.assign(new Error(), { name: 'NotAllowedError' })),
  );
  await music.sync();
  assert.equal(music.state, 'blocked');
});
