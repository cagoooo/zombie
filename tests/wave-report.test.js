import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, BRANCHES } from '../src/game.js';
import { writeSaveFile, readSaveFile, MAX_SAVE_BYTES } from '../src/save-transfer.js';
import { checkpoint, restore } from '../src/save.js';
import { currentWaveReport, tacticalAdvice } from '../src/wave-report.js';

test('逐波帳目包含戰中建造升級退款、擊退與清波獎勵，下一波不重複', () => {
  const g = new Game();
  g.build(0, 'pulse');
  g.startWave();
  assert.equal(g.activeWaveReport.startCredits, 200);
  g.build(1, 'pulse');
  g.upgrade(g.towers[0].id);
  g.sell(g.towers[1].id);
  g.damage(
    { hp: 10, shield: 0, type: 'basic', slow: 0, reward: 12 },
    999,
    0,
    false,
    'weapon:pulse',
  );
  g.spawnLeft = 0;
  g.enemies = [];
  g.update(0.01);
  const r = g.waveHistory[0];
  assert.equal(r.income, 87);
  assert.equal(r.spent, 170);
  assert.equal(r.refund, 70);
  assert.equal(r.endCredits, 187);
  assert.equal(r.stats.sources['weapon:pulse'].hp, 10);
  const restored = restore(checkpoint(g));
  assert.deepEqual(restored.waveHistory, g.waveHistory);
  restored.startWave();
  assert.equal(currentWaveReport(restored).stats.breaches, 0);
  assert.deepEqual(currentWaveReport(restored).stats.sources, {});
  const count = g.waveHistory.length;
  g.update(0.1);
  assert.equal(g.waveHistory.length, count);
  g.reset();
  assert.deepEqual(g.waveHistory, []);
});
test('失敗波記錄護盾與核心實際損失、漏怪種類，建議有依據且最多三則', () => {
  const g = new Game('factory-2');
  g.health = 1;
  g.startWave();
  g.spawnLeft = 0;
  g.spawn('shielded', g.map.length - 0.001, false);
  g.update(0.1);
  const r = g.waveHistory[0];
  assert.equal(r.status, 'lost');
  assert.equal(r.stats.coreDamage, 1);
  assert.equal(r.breachTypes.shielded, 1);
  const tips = tacticalAdvice([r]);
  assert.ok(tips[0].includes('護盾感染者突破 1'));
  assert.ok(tips.length <= 3);
  assert.equal(g.activeWaveReport, null);
  assert.ok(tacticalAdvice([])[0].includes('尚無逐波紀錄'));
});
test('舊存檔不虛構逐波資料，拒絕不一致能源、重複波次與非法漏怪', () => {
  const g = new Game();
  g.startWave();
  g.spawnLeft = 0;
  g.update(0.01);
  const raw = checkpoint(g);
  const old = structuredClone(raw);
  delete old.waveHistory;
  assert.deepEqual(restore(old).waveHistory, []);
  for (const corrupt of [
    (r) => r.waveHistory[0].income++,
    (r) => r.waveHistory.push(r.waveHistory[0]),
    (r) => (r.waveHistory[0].breachTypes.invalid = 1),
    (r) => delete r.waveHistory[0].stats,
    (r) => (r.waveHistory[0].stats.coreDamage = 1),
  ]) {
    const bad = structuredClone(raw);
    corrupt(bad);
    assert.throws(() => restore(bad));
  }
});
test('升級塔出售退款與實際整數運算一致，不受浮點乘法誤差影響', () => {
  const g = new Game();
  g.build(0, 'pulse');
  g.upgrade(g.towers[0].id);
  g.startWave();
  g.sell(g.towers[0].id);
  assert.equal(currentWaveReport(g).refund, 119);
  assert.equal(currentWaveReport(g).endCredits, 249);
});
test('暫停統計快照不修改累計、未結束波不寫入檢查點歷史', () => {
  const g = new Game();
  g.startWave();
  g.damage({ hp: 20, shield: 0, type: 'basic', slow: 0, reward: 12 }, 30, 0, false, 'skill:emp');
  g.paused = true;
  const before = structuredClone(g.report),
    row = currentWaveReport(g);
  row.stats.sources['skill:emp'].hp = 999;
  g.update(60);
  assert.deepEqual(g.report, before);
  assert.equal(g.waveHistory.length, 0);
  assert.equal(checkpoint(g), null);
});
test('兩圖正常資源十波逐波加總等於累計，每波匯出匯入不丟資料且低於64KiB', () => {
  for (const map of ['outpost-1', 'factory-2']) {
    let g = new Game(map);
    const plan = [
      [0, 'pulse'],
      [1, 'cryo'],
      [7, 'plasma'],
      [4, 'arc'],
      [3, 'plasma'],
      [5, 'pulse'],
      [2, 'repair'],
      [6, 'plasma'],
    ];
    for (let step = 0; step < 30000 && !['won', 'lost'].includes(g.phase); step++) {
      for (const [pad, type] of plan)
        if (!g.towers.some((t) => t.pad === pad)) {
          g.build(pad, type);
          break;
        }
      if (g.towers.length === 8)
        for (const t of g.towers) g.upgrade(t.id, Object.keys(BRANCHES[t.type] ?? {})[0]);
      if (g.phase === 'ready') {
        const json = writeSaveFile(g);
        assert.ok(Buffer.byteLength(json) < MAX_SAVE_BYTES);
        const restored = readSaveFile(json);
        assert.deepEqual(restored.waveHistory, g.waveHistory);
        g = restored;
        g.startWave();
      }
      g.update(0.05);
      const e = g.enemies.filter((e) => e.hp > 0).sort((a, b) => b.distance - a.distance)[0];
      if (e) g.fire(e);
      g.useEMP();
      g.events = [];
    }
    assert.equal(g.phase, 'won');
    assert.equal(g.waveHistory.length, 10);
    for (const key of ['breaches', 'coreDamage', 'shieldAbsorbed', 'baseRepair', 'supportRepair'])
      assert.ok(
        Math.abs(g.waveHistory.reduce((sum, r) => sum + r.stats[key], 0) - g.report[key]) < 1e-6,
      );
    for (const [source, row] of Object.entries(g.report.sources))
      for (const key of ['hp', 'shield', 'kills'])
        assert.ok(
          Math.abs(
            g.waveHistory.reduce((sum, r) => sum + (r.stats.sources[source]?.[key] ?? 0), 0) -
              row[key],
          ) < 1e-6,
        );
  }
});
