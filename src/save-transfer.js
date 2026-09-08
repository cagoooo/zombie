import { checkpoint, restore, SAVE_KEY } from './save.js';
export const BACKUP_KEY = 'deadzone-before-import-v1';
export const MAX_SAVE_BYTES = 64 * 1024;

export function readSaveFile(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SAVE_BYTES) throw Error('檔案超過 64 KiB 上限');
  let data;
  try { data = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw Error('檔案不是有效的 JSON 存檔'); }
  if (data?.format !== undefined && (data.format !== 'deadzone-save' || data.formatVersion !== 1)) throw Error('不是支援的 DEADZONE 存檔格式');
  const game = restore(data?.format === 'deadzone-save' ? data.checkpoint : data);
  return restore(checkpoint(game));
}
export function writeSaveFile(game) {
  const data = checkpoint(game);
  if (!data) throw Error('只能匯出準備階段檢查點');
  return JSON.stringify({ format: 'deadzone-save', formatVersion: 1, exportedAt: new Date().toISOString(), checkpoint: checkpoint(restore(data)) }, null, 2);
}

export function setupSaveTransfer({ getGame, applyGame }) {
  const $ = id => document.getElementById(id);
  let pending = null, sequence = 0;
  const status = message => { $('transfer-status').textContent = message; };
  function cancel() {
    sequence++; pending = null;
    $('import-preview').hidden = true;
    $('import-file').value = '';
  }
  function preview(game) {
    pending = game;
    $('import-summary').textContent = `能源前哨 · 第 ${game.wave + 1} 波準備 · 核心 ${game.health}% · 能源 ${game.credits} · ${game.towers.length} 座塔 · EMP 冷卻 ${Math.ceil(game.empCooldown)} 秒。`;
    $('import-preview').hidden = false;
    status('尚未替換戰局。確認後會先備份目前部署；取消則保留現況。');
  }
  $('export-save').onclick = () => {
    try {
      const game = getGame();
      const source = game.phase === 'ready' ? game : restore(localStorage.getItem(SAVE_KEY));
      const url = URL.createObjectURL(new Blob([writeSaveFile(source)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `deadzone-wave-${source.wave + 1}.json`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      status(game.phase === 'ready' ? '已送出存檔下載，請查看瀏覽器下載清單。' : '已送出最近準備存檔下載，不包含當前波內進度；請查看瀏覽器下載清單。');
    } catch { status('沒有可匯出的準備存檔，或瀏覽器未開放儲存。'); }
  };
  $('import-file').onchange = async () => {
    const file = $('import-file').files[0]; cancel(); const token = sequence;
    if (!file) return;
    try {
      if (getGame().phase !== 'ready') throw Error('請先完成目前波次，再於準備階段匯入');
      if (file.size > MAX_SAVE_BYTES) throw Error('檔案超過 64 KiB 上限');
      const game = readSaveFile(await file.text());
      if (token === sequence) preview(game);
    } catch (error) { if (token === sequence) status(`匯入未套用：${error.message}`); }
  };
  $('restore-import-backup').onclick = () => {
    cancel();
    try {
      if (getGame().phase !== 'ready') throw Error('準備階段才可還原');
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) throw Error('目前沒有匯入前備份');
      preview(readSaveFile(raw));
    } catch (error) { status(error.message); }
  };
  $('cancel-import').onclick = () => { cancel(); status('已取消，原戰局保留。'); };
  $('confirm-import').onclick = () => {
    if (!pending) return;
    try {
      if (getGame().phase !== 'ready') throw Error('準備階段才可替換部署');
      const next = pending;
      const old = JSON.stringify(checkpoint(getGame()));
      localStorage.setItem(BACKUP_KEY, old);
      localStorage.setItem(SAVE_KEY, JSON.stringify(checkpoint(next)));
      applyGame(next);
      cancel(); status('匯入完成；已保留替換前部署，可按「還原匯入前備份」。');
    } catch (error) { status(`匯入未完成：${error.message}`); }
  };
  return { cancel };
}
