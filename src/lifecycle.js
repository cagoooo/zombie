// One gate for desktop blur, tab hiding and mobile page lifecycle navigation.
export function installPagePause(win,doc,{clearInput,shouldPause,pause}) {
 const suspend=()=>{clearInput();if(shouldPause())pause();};
 const visibility=()=>{if(doc.hidden)suspend();};
 win.addEventListener('blur',suspend);
 win.addEventListener('pagehide',suspend);
 doc.addEventListener('visibilitychange',visibility);
 return ()=>{win.removeEventListener('blur',suspend);win.removeEventListener('pagehide',suspend);doc.removeEventListener('visibilitychange',visibility);};
}
