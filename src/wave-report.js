import { newReport, restoreReport } from './battle-report.js';
const counters = ['breaches', 'coreDamage', 'shieldAbsorbed', 'baseRepair', 'supportRepair'];
const types = ['basic', 'runner', 'tank', 'armored', 'dasher', 'shielded', 'boss'];
export function beginWaveReport(game) {
  return {
    wave: game.wave,
    status: 'active',
    startCredits: game.credits,
    income: 0,
    spent: 0,
    refund: 0,
    breachTypes: {},
    baseline: structuredClone(game.report),
  };
}
export function currentWaveReport(game) {
  const a = game.activeWaveReport;
  if (!a) return null;
  const stats = newReport();
  for (const key of counters) stats[key] = Math.max(0, game.report[key] - a.baseline[key]);
  for (const [key, row] of Object.entries(game.report.sources)) {
    const before = a.baseline.sources[key] ?? { hp: 0, shield: 0, kills: 0 };
    const delta = Object.fromEntries(
      ['hp', 'shield', 'kills'].map((k) => [k, Math.max(0, row[k] - before[k])]),
    );
    if (delta.hp || delta.shield || delta.kills) stats.sources[key] = delta;
  }
  const { baseline, ...data } = a;
  return { ...data, breachTypes: { ...a.breachTypes }, endCredits: game.credits, stats };
}
export function finishWaveReport(game, status) {
  const row = currentWaveReport(game);
  if (!row) return;
  row.status = status;
  game.waveHistory.push(row);
  game.activeWaveReport = null;
}
export function restoreWaveHistory(raw, wave, maxKills, cumulative) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 10) throw Error('逐波戰報格式不合法');
  let previous = 0;
  const history = raw.map((row) => {
    if (
      !row ||
      !Number.isInteger(row.wave) ||
      row.wave <= previous ||
      row.wave > wave ||
      row.status !== 'cleared'
    )
      throw Error('逐波戰報波次不合法');
    previous = row.wave;
    const result = { wave: row.wave, status: 'cleared', breachTypes: {} };
    for (const key of ['startCredits', 'endCredits', 'income', 'spent', 'refund']) {
      if (!Number.isInteger(row[key]) || row[key] < 0 || row[key] > 1000000)
        throw Error('逐波能源數值不合法');
      result[key] = row[key];
    }
    if (result.startCredits + result.income + result.refund - result.spent !== result.endCredits)
      throw Error('逐波能源帳目不符');
    if (!row.breachTypes || typeof row.breachTypes !== 'object' || Array.isArray(row.breachTypes))
      throw Error('漏怪種類不合法');
    for (const [key, n] of Object.entries(row.breachTypes)) {
      if (!types.includes(key) || !Number.isInteger(n) || n < 0 || n > maxKills)
        throw Error('漏怪種類不合法');
      result.breachTypes[key] = n;
    }
    if (!row.stats || row.stats.complete !== true) throw Error('逐波統計資料不完整');
    result.stats = restoreReport(row.stats, maxKills, maxKills);
    if (Object.values(result.breachTypes).reduce((a, b) => a + b, 0) !== result.stats.breaches)
      throw Error('漏怪數量不符');
    return result;
  });
  if (cumulative) {
    for (const key of counters)
      if (history.reduce((sum, r) => sum + r.stats[key], 0) > cumulative[key] + 1e-6)
        throw Error('逐波統計超過累計');
    const sources = {};
    for (const r of history)
      for (const [key, row] of Object.entries(r.stats.sources)) {
        const sum = (sources[key] ??= { hp: 0, shield: 0, kills: 0 });
        for (const k of ['hp', 'shield', 'kills']) {
          sum[k] += row[k];
          if (sum[k] > (cumulative.sources[key]?.[k] ?? 0) + 1e-6) throw Error('逐波來源超過累計');
        }
      }
  }
  return history;
}
export function tacticalAdvice(rows) {
  if (!rows.length) return ['尚無逐波紀錄；完成一波或在戰鬥中暫停後，即可查看依據。'];
  rows = rows.filter(
    (r) =>
      r.status !== 'active' ||
      r.stats.breaches > 0 ||
      Object.values(r.stats.sources).some((s) => s.kills > 0),
  );
  if (!rows.length)
    return ['本波尚無擊退或漏怪，資料不足以判斷部署效果；可先查看下一波情報與敵人克制提示。'];
  const leaks = {},
    sum = { breaches: 0, coreDamage: 0, shieldAbsorbed: 0 };
  for (const r of rows) {
    for (const k in sum) sum[k] += r.stats[k];
    for (const [k, n] of Object.entries(r.breachTypes)) leaks[k] = (leaks[k] ?? 0) + n;
  }
  const tips = [];
  if (leaks.shielded)
    tips.push(
      `護盾感染者突破 ${leaks.shielded} 隻：可在路線前段配置電弧，或在敵人接近角色時使用 EMP 加倍剝盾。`,
    );
  if (leaks.armored)
    tips.push(`裝甲感染者突破 ${leaks.armored} 隻：試用電弧武器／塔，避免一般攻擊的 40% 減傷。`);
  if ((leaks.runner ?? 0) + (leaks.dasher ?? 0))
    tips.push(
      `高速敵人突破 ${(leaks.runner ?? 0) + (leaks.dasher ?? 0)} 隻：彎道搭配冰凍塔，延長集火時間。${leaks.dasher ? '衝刺敵人的預警期可用冰凍／EMP 中止。' : ''}`,
    );
  if (sum.coreDamage > 0) {
    const last = rows.at(-1);
    tips.push(
      `紀錄中核心實際損失 ${sum.coreDamage}，最後可用能源 ${last.endCredits}：${last.endCredits >= 100 ? '下次部署時可比較現有塔升級與路線後段補塔。' : '先檢查射程覆蓋及目標策略，再決定下一次投資。'}`,
    );
  }
  if (!sum.breaches)
    tips.push(
      `已記錄的 ${rows.length} 波目前沒有漏怪；可維持部署，依下一波情報預留克制敵人的能源。`,
    );
  if (sum.breaches && !tips.length)
    tips.push(
      `已記錄 ${sum.breaches} 隻敵人突破，護盾吸收 ${sum.shieldAbsorbed} 傷害：檢查路線後段的射程覆蓋，並比較「最前方」目標策略。`,
    );
  return tips.slice(0, 3);
}
