export class Tutorial {
  constructor() {
    this.steps = [
      ['move', '移動：WASD／方向鍵；手機拖曳左搖桿。Shift 可奔跑。'],
      ['shoot', '射擊：滑鼠瞄準並按住；手機拖曳右搖桿瞄準與開火。先開始波次才會發射。'],
      ['switch', '切槍：按 1／2／3，或點擊武器按鈕。留意熱量與射程。'],
      ['build', '建塔：按 B 或「建造」，選塔型再點「＋」。選已建塔可升級／出售。'],
      ['wave', '開波：部署完成後開始波次。敵人只攻核心，人物不會受傷。'],
    ];
    this.done = new Set();
    this.hidden = false;
    try {
      this.hidden = localStorage.getItem('deadzone-tutorial') === 'done';
    } catch {}
    document.getElementById('tutorial-skip').onclick = () => this.finish();
    this.draw();
  }
  mark(id) {
    if (this.hidden) return;
    this.done.add(id);
    this.draw();
  }
  finish() {
    this.hidden = true;
    try {
      localStorage.setItem('deadzone-tutorial', 'done');
    } catch {}
    this.draw();
  }
  restart() {
    this.done.clear();
    this.hidden = false;
    this.draw();
  }
  draw() {
    const el = document.getElementById('tutorial');
    el.hidden = this.hidden;
    if (this.hidden) return;
    const step = this.steps.find(([id]) => !this.done.has(id));
    if (!step) {
      this.finish();
      return;
    }
    document.getElementById('tutorial-text').textContent =
      `新手訓練 ${this.done.size}/5 · ${step[1]}`;
  }
}
