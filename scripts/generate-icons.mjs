import fs from 'node:fs';
import { createCanvas, Path2D } from '@napi-rs/canvas';
import pngToIco from 'png-to-ico';
fs.mkdirSync('public/icons', {recursive:true});
const shield='M32 3 57 14 55 39 44 54 32 62 20 54 9 39 7 14Z';
const bolt='M35 12 19 35 30 35 26 52 46 27 34 27Z';
fs.writeFileSync('public/favicon.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#101713"/><path d="${shield}" fill="#d8f36a"/><path d="${bolt}" fill="#101713"/></svg>`);
function icon(size,maskable=false) {
  const c=createCanvas(size,size),x=c.getContext('2d'); x.fillStyle='#101713';x.fillRect(0,0,size,size);
  const scale=(maskable?.68:.86)*size/64; x.translate(size/2,size/2);x.scale(scale,scale);x.translate(-32,-32);
  x.fillStyle='#d8f36a';x.fill(new Path2D(shield));x.fillStyle='#101713';x.fill(new Path2D(bolt));
  return c.toBuffer('image/png');
}
for(const size of [16,32,48,180,192,512])fs.writeFileSync(size===180?'public/apple-touch-icon.png':`public/icons/icon-${size}.png`,icon(size));
for(const size of [192,512])fs.writeFileSync(`public/icons/icon-${size}-maskable.png`,icon(size,true));
fs.writeFileSync('public/favicon.ico',await pngToIco([16,32,48].map(n=>`public/icons/icon-${n}.png`)));
console.log('網站圖示已產生：SVG、ICO、Apple touch 與 192／512 一般及 maskable PNG。');
