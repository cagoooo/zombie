import { CosmeticAssets } from './cosmetic-assets.js';
import { SKINS, TARGETS, COSMETICS_KEY, defaults, normalizeCosmetics, skinFor } from './cosmetics-core.js';
import './cosmetics.css';

const $=id=>document.getElementById(id);
export class Cosmetics {
  constructor({view,game,sound,clearInput,toast}) {
    Object.assign(this,{view,game,sound,clearInput,toast});
    this.assets=new CosmeticAssets(view);
    this.selected=defaults();
    try { this.selected=normalizeCosmetics(JSON.parse(localStorage.getItem(COSMETICS_KEY))); } catch {}
    this.target='guard'; this.revision=0; this.opened=false; this.angle=.4;
    $('open-cosmetics').onclick=()=>this.open();
    $('close-cosmetics').onclick=()=>this.close();
    $('apply-cosmetics').onclick=()=>this.apply();
    $('reset-cosmetics').onclick=()=>{this.draft=defaults();this.showChoices();this.choose(this.draft[this.target]);};
    $('retry-cosmetic').onclick=()=>this.choose(this.candidate);
    $('rotate-cosmetic').onclick=()=>{this.angle+=Math.PI/2;this.drawPreview();};
    document.querySelectorAll('[data-skin-target]').forEach(button=>{
      button.onclick=()=>{this.target=button.dataset.skinTarget;this.angle=.4;this.showChoices();this.choose(this.draft[this.target]);};
    });
    $('cosmetics-overlay').addEventListener('keydown',event=>{
      if(event.code==='Escape'){event.preventDefault();event.stopPropagation();this.close();}
      if(event.code==='Tab'){
        const controls=[...$('cosmetics-overlay').querySelectorAll('button,a[href]')].filter(e=>!e.hidden&&!e.disabled);
        const index=controls.indexOf(document.activeElement);
        controls[(index+(event.shiftKey?-1:1)+controls.length)%controls.length]?.focus();
        event.preventDefault();
      }
    });
  }
  async restore() {
    const ticket=++this.revision;
    this.restoring=true;
    const entries=await Promise.all(TARGETS.map(async target=>{
      let id=this.selected[target],source;
      let timer;
      try{source=await Promise.race([this.assets.load(skinFor(target,id)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('restore timeout')),15000);})]);}
      catch { id=target+'-original'; source=this.view.models[skinFor(target,id).asset]; }
      finally{clearTimeout(timer);}
      return {target,id,source};
    }));
    if(ticket!==this.revision)return;
    let failed=false;
    for(const {target,id,source} of entries){
      if(this.selected[target]!==id)failed=true;
      this.selected[target]=id;
      this.view.applyAppearance(target,source,id);
    }
    this.restoring=false;
    if(failed) this.toast('部分外觀載入失敗，已使用原版；可在裝備外觀重新選擇。');
  }
  open() {
    if(this.game.phase!=='ready'||!$('loading-panel').hidden||!$('checkpoint-panel').hidden||!$('overlay').hidden||!$('settings-overlay').hidden)return;
    if(this.restoring)return;
    this.revision++;this.opened=true;this.wasPaused=this.game.paused;
    this.previousFocus=document.activeElement;this.game.paused=true;this.clearInput();this.sound.setPaused(true);
    this.draft={...this.selected};this.target='guard';this.angle=.4;
    $('cosmetics-overlay').hidden=false; $('app').inert=true;
    this.showChoices();this.choose(this.draft.guard);$('close-cosmetics').focus();
  }
  close() {
    this.revision++;this.opened=false;$('cosmetics-overlay').hidden=true;$('app').inert=false;
    this.game.paused=this.wasPaused;this.sound.setPaused(this.game.paused);this.clearInput();
    this.previousFocus?.focus();
  }
  showChoices() {
    document.querySelectorAll('[data-skin-target]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.skinTarget===this.target));
    $('skin-choices').replaceChildren();
    for(const skin of SKINS.filter(s=>s.target===this.target)){
      const button=document.createElement('button');button.dataset.skinId=skin.id;
      button.className='skin-choice '+skin.variant;
      button.setAttribute('aria-pressed',this.draft[this.target]===skin.id);
      const swatch=document.createElement('i');swatch.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.textContent=skin.name;
      const note=document.createElement('small');note.textContent=skin.variant==='original'?'原版 · 已隨遊戲載入':'極地裝甲 · 按需載入';
      button.append(swatch,label,note);button.onclick=()=>this.choose(skin.id);$('skin-choices').append(button);
    }
  }
  async choose(id) {
    const ticket=++this.revision, target=this.target, skin=skinFor(target,id);
    this.candidate=skin.id;this.previewSource=null;
    $('apply-cosmetics').disabled=true;$('rotate-cosmetic').disabled=true;$('retry-cosmetic').hidden=true;
    $('cosmetic-preview').hidden=true;$('cosmetic-status').textContent='正在載入 '+skin.label+' · '+skin.name+'…';
    $('cosmetic-name').textContent=skin.label+' · '+skin.name;
    $('cosmetic-source').href=skin.source;$('cosmetic-source').textContent=skin.author+' · '+skin.license;
    try {
      // Deadline only affects this selection; late downloads are cached, never auto-applied.
      let timer;
      const source=await Promise.race([this.assets.load(skin),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('連線逾時，可重試或取消')),15000);})]).finally(()=>clearTimeout(timer));
      if(ticket!==this.revision||!this.opened)return;
      this.draft[target]=skin.id;this.previewSource=source;this.showChoices();this.drawPreview();
      $('cosmetic-status').textContent='預覽中；套用後才會改變戰場外觀。純外觀，不影響能力。';
      $('apply-cosmetics').disabled=false;$('rotate-cosmetic').disabled=false;
    } catch(error) {
      if(ticket!==this.revision||!this.opened)return;
      if(skin.asset&&!this.view.models[skin.asset]){
        this.draft[target]=skin.id;this.showChoices();
        $('cosmetic-status').textContent='原模型尚未載入；套用後使用遊戲備援造型，仍可正常遊玩。';
        $('apply-cosmetics').disabled=false;
        return;
      }
      $('cosmetic-status').textContent='外觀未載入：'+error.message+' 目前裝備保留，可重試或選原版。';
      $('retry-cosmetic').hidden=false;
    }
  }
  drawPreview() {
    if(!this.previewSource)return;
    $('cosmetic-preview').src=this.view.appearancePreview(this.previewSource,this.target==='guard',this.angle);
    $('cosmetic-preview').alt=$('cosmetic-name').textContent+' 3D 預覽';$('cosmetic-preview').hidden=false;
  }
  async apply() {
    if(!this.opened||this.game.phase!=='ready'||$('apply-cosmetics').disabled)return;
    const ticket=++this.revision;const selection={...this.draft};$('apply-cosmetics').disabled=true;
    try {
      const sources=await Promise.all(TARGETS.map(target=>{
        const skin=skinFor(target,selection[target]);
        return skin.asset ? this.view.models[skin.asset] : this.assets.load(skin);
      }));
      if(ticket!==this.revision||!this.opened)return;
      TARGETS.forEach((target,index)=>this.view.applyAppearance(target,sources[index],selection[target]));
      this.selected=selection;
      let saved=true;
      try { localStorage.setItem(COSMETICS_KEY,JSON.stringify({version:1,selected:selection})); } catch {saved=false;}
      this.close();this.toast(saved?'裝備外觀已套用並保存。':'外觀已套用，但瀏覽器無法保存選擇。');
    } catch(error){
      if(ticket!==this.revision||!this.opened)return;
      $('cosmetic-status').textContent='套用失敗，原裝備保留：'+error.message;
      $('apply-cosmetics').disabled=false;
    }
  }
  snapshot(){return {selected:{...this.selected},applied:{...this.view.appearanceIds},opened:this.opened,restoring:this.restoring,cached:this.assets.cache.size};}
}
