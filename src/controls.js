import { WEAPONS } from './game.js';

export function screenVector(x, y) {
  const a = 24 / Math.hypot(24, 37),
    b = 37 / Math.hypot(24, 37);
  return { x: x * b + y * a, z: -x * a + y * b };
}
export class Controls {
  constructor({ canAct, shoot, aim }) {
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this.aimStick = null;
    this.pointers = new Map();
    this.sprint = false;
    this.canAct = canAct;
    this.shoot = shoot;
    this.aim = aim;
    window.addEventListener('keydown', (e) => {
      if (
        !canAct() ||
        /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'ShiftLeft',
          'ShiftRight',
        ].includes(e.code)
      ) {
        e.preventDefault();
        this.keys.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    for (const id of ['move-stick', 'aim-stick']) {
      const el = document.getElementById(id),
        isMove = id === 'move-stick';
      const update = (e) => {
        const r = el.getBoundingClientRect(),
          dx = (e.clientX - r.left - r.width / 2) / 35,
          dy = (e.clientY - r.top - r.height / 2) / 35,
          n = Math.max(1, Math.hypot(dx, dy));
        const v = { x: dx / n, y: dy / n };
        el.firstElementChild.style.transform = `translate(${v.x * 28}px,${v.y * 28}px)`;
        if (isMove) this.stick = v;
        else {
          if (Math.hypot(dx, dy) > 0.12) this.aimStick = v;
          this.shoot(true);
        }
      };
      el.addEventListener('pointerdown', (e) => {
        if (!canAct() || this.pointers.has(id)) return;
        e.preventDefault();
        this.pointers.set(id, e.pointerId);
        el.setPointerCapture(e.pointerId);
        update(e);
      });
      el.addEventListener('pointermove', (e) => {
        if (this.pointers.get(id) === e.pointerId) update(e);
      });
      const release = (e) => {
        if (this.pointers.get(id) !== e.pointerId) return;
        this.pointers.delete(id);
        el.firstElementChild.style.transform = '';
        if (isMove) this.stick = { x: 0, y: 0 };
        else {
          this.aimStick = null;
          this.shoot(false);
        }
      };
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        el.addEventListener(event, release);
    }
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
  }
  clear() {
    this.keys.clear();
    this.stick = { x: 0, y: 0 };
    this.aimStick = null;
    this.pointers.clear();
    this.shoot(false);
    document.querySelectorAll('.joystick i').forEach((e) => (e.style.transform = ''));
  }
  update(game, dt) {
    if (!this.canAct()) {
      this.clear();
      game.player.moving = false;
      return;
    }
    const held = (...names) => (names.some((n) => this.keys.has(n)) ? 1 : 0);
    const v = screenVector(
      this.stick.x + held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft'),
      this.stick.y + held('KeyS', 'ArrowDown') - held('KeyW', 'ArrowUp'),
    );
    game.move(v.x, v.z, dt, this.sprint || !!held('ShiftLeft', 'ShiftRight'));
    if (this.aimStick) {
      const dir = screenVector(this.aimStick.x, this.aimStick.y);
      const range = WEAPONS[game.weapon].range;
      this.aim({ x: game.player.x + dir.x * range, z: game.player.z + dir.z * range });
    }
  }
}
