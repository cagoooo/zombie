// One gate for desktop blur, tab hiding and mobile page lifecycle navigation.
export const PAUSE_REASONS={
 manual:'已手動暫停。按「繼續防守」恢復遊戲。',
 blur:'遊戲視窗失去焦點，已自動暫停。回到遊戲後按「繼續防守」，不會自動開火。',
 hidden:'遊戲頁面進入背景，已自動暫停。返回頁面後按「繼續防守」，不會補算背景時間。',
 pagehide:'離開遊戲頁面時已自動暫停。若瀏覽器保留戰局，按「繼續防守」恢復；重新載入則回到準備存檔。',
};
export function installPagePause(win,doc,{clearInput,shouldPause,pause,updateReason}) {
 const suspend=reason=>{clearInput();if(shouldPause())pause(reason);else updateReason?.(reason);};
 const blur=()=>suspend(doc.hidden?'hidden':'blur');
 const pagehide=()=>suspend('pagehide');
 const visibility=()=>{if(doc.hidden)suspend('hidden');};
 win.addEventListener('blur',blur);
 win.addEventListener('pagehide',pagehide);
 doc.addEventListener('visibilitychange',visibility);
 return ()=>{win.removeEventListener('blur',blur);win.removeEventListener('pagehide',pagehide);doc.removeEventListener('visibilitychange',visibility);};
}
