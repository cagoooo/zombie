import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {loadImage} from '@napi-rs/canvas';
async function inspectAsset(file,bytes){
  const binary=file.endsWith('.glb');
  const gltf=JSON.parse(binary?bytes.subarray(20,20+bytes.readUInt32LE(12)):bytes.toString());
  const buffers=(gltf.buffers||[]).map(buffer=>buffer.uri
    ?(buffer.uri.startsWith('data:')?Buffer.from(buffer.uri.split(',')[1],'base64'):fs.readFileSync(path.resolve(path.dirname(file),buffer.uri)))
    :bytes.subarray(28+bytes.readUInt32LE(12)));
  const textures=[];
  for(const entry of gltf.images||[]){
    const view=gltf.bufferViews?.[entry.bufferView];
    const data=entry.uri?(entry.uri.startsWith('data:')?Buffer.from(entry.uri.split(',')[1],'base64'):fs.readFileSync(path.resolve(path.dirname(file),entry.uri)))
      :buffers[view.buffer].subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
    const image=await loadImage(data);textures.push({width:image.width,height:image.height,bytes:data.length});
  }
  const triangles=(gltf.meshes||[]).flatMap(mesh=>mesh.primitives).reduce((sum,p)=>sum+((p.mode??4)===4?gltf.accessors[p.indices??p.attributes.POSITION].count/3:0),0);
  return {triangles,textures};
}
const report=JSON.parse(fs.readFileSync('artifacts/blender-skins-report.json'));
for(const entry of report){
  const bytes=fs.readFileSync(entry.path);
  entry.bytes=bytes.length;entry.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  if(gltf.scenes?.some(scene=>scene.extras?.finish_workflow))entry.workflow='Blender background Python; material finishing/export via Blender MCP';
}
fs.writeFileSync('artifacts/blender-skins-report.json',JSON.stringify(report,null,2));
const targets={guard:['守衛','Characters_Sam_SingleWeapon','Characters_Sam_SingleWeapon.gltf'],pulse:['脈衝步槍','blaster-a','pulse-mk2.glb'],plasma:['電漿重砲','blaster-j','blaster-j.glb'],cryo:['冰霜射線','blaster-o','blaster-o.glb']};
const entries=[];
for(const [target,[label,asset,file]] of Object.entries(targets)){
  const r=report.find(r=>r.target===target);
  for(const variant of ['original','polar']){
    const path=variant==='original'?'public/models/'+file:r.path, bytes=fs.readFileSync(path);
    const metrics=await inspectAsset(path,bytes);
    entries.push({id:target+'-'+variant,target,label,name:variant==='original'?'能源守衛':'極地偵巡',variant,asset:variant==='original'?asset:null,
      file:path.slice(7),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
      author:r.author,license:'CC0-1.0',source:target==='guard'?'https://quaternius.com/packs/zombieapocalypsekit.html':'https://kenney.nl/assets/blaster-kit',
      height:target==='guard'?1.9:null,length:target==='guard'?null:2.3,up:'+Y',forward:'+Z',
      grip:target==='guard'?'Middle1.L':[0,0,0],muzzle:target==='guard'?null:'Muzzle',
      animations:target==='guard'?['Idle_Gun','Walk_Gun','Run_Gun']:[],
      regions:variant==='polar'?['Polar_Armor','Polar_Graphite',...(target==='guard'?['Atlas']:['Polar_Energy'])]:['source materials'],
      ...metrics,preview:'runtime-shared-renderer',version:1,blend:variant==='polar'?r.blend:null});
  }
}
fs.writeFileSync('src/skin-catalog.json',JSON.stringify(entries,null,2)+'\n');
const manifest=JSON.parse(fs.readFileSync('asset-manifest.json'));
for(const r of report){const i=manifest.findIndex(e=>e.path===r.path);if(i>=0)manifest[i]=r;else manifest.push(r);}
fs.writeFileSync('asset-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log({entries:entries.length,additionalBytes:report.reduce((sum,r)=>sum+r.bytes,0)});
