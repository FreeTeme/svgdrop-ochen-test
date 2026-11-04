import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectObjects,validatePalette,palettes,compose,recolor,exportSvg,formats} from './dist/core.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('./dist/assets/manifest.json',import.meta.url)));
const assets=Object.fromEntries(manifest.map(a=>[a.id,fs.readFileSync(new URL('./dist/assets/'+a.file,import.meta.url),'utf8')]));
for(let i=0;i<3;i++)for(const s of ['S','L'])assets[`background-${i}-${s}`]=fs.readFileSync(new URL(`./dist/assets/background-${i}-${s}.svg`,import.meta.url),'utf8');
test('semantic matches and explicitly unknown themes',()=>{assert.deepEqual(selectObjects('Финансовый рост').keys,['coin','flowers']);assert.ok(selectObjects('Команда решает задачи').keys.includes('puzzle'));assert.equal(selectObjects('космические путешествия').matched,false)});
test('all original objects have both detail levels and variants',()=>{assert.equal(manifest.length,40);for(const a of manifest){assert.ok(a.width>0&&a.height>0);assert.ok(a.paths>0);assert.ok(!assets[a.id].includes('<image'));assert.ok(!assets[a.id].includes('<script'))}});
test('layouts keep objects inside the artboard and preserve aspect',()=>{for(const format of Object.keys(formats))for(const detail of ['S','L'])for(const layout of ['balanced','offset','headline']){const [W,H]=formats[format];const scene=compose(['book','lamp','phone','flowers'],manifest,{format,detail,layout});for(const l of scene){assert.ok(l.x-l.w/2>=-.001&&l.x+l.w/2<=W+.001);assert.ok(l.y-l.h/2>=-.001&&l.y+l.h/2<=H+.001);const a=manifest.find(a=>a.key===l.key&&a.variant===l.variant&&a.size===detail);assert.ok(Math.abs(l.w/l.h-a.width/a.height)<1e-8)}}});
test('palette replaces colors without changing vector geometry',()=>{const raw=assets['phone-main-L'];const out=recolor(raw,palettes[2]);assert.ok(out.includes('#5ABEBE'));const geometry=s=>[...s.matchAll(/\bd="([^"]*)"/g)].map(m=>m[1]);assert.deepEqual(geometry(out),geometry(raw));assert.throws(()=>validatePalette({...palettes[0],object:['url(evil)','#FFFFFF','#000000']}));assert.throws(()=>validatePalette({name:'bad'}))});
test('SVG export keeps layer transforms, hidden layers, transparency and safe title',()=>{const state={title:'<script>alert(1)</script>',format:'landscape',detail:'L',palette:palettes[1],paletteIndex:1,transparent:true,texture:true,layers:compose(['book','phone'],manifest,{backgroundObjects:false})};state.layers[0].rotation=35;state.layers[1].visible=false;const svg=exportSvg(state,assets,manifest);assert.ok(svg.includes('rotate(35)'));assert.ok(!svg.includes('id="layer-2"'));assert.ok(!svg.includes('<image'));assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('<rect'));assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('viewBox="0 0 1200 630"'))});

import {resizeFromCorner,rotationFromPointer} from './dist/transforms.mjs';
test('manual composition contains exactly the requested objects, including an empty canvas',()=>{
 for(const keys of [[],['book'],['book','phone'],['puzzle','puzzle']]){
  const layers=compose(keys,manifest,{backgroundObjects:false});
  assert.deepEqual(layers.map(l=>l.key),keys);assert.ok(layers.every(l=>l.variant==='main'));
 }
 assert.deepEqual(compose([],manifest),[]);
});
test('corner resize keeps the opposite corner fixed after rotation and preserves aspect',()=>{
 const point=(l,sx,sy)=>{const a=l.rotation*Math.PI/180;return {x:l.x+Math.cos(a)*sx*l.w/2-Math.sin(a)*sy*l.h/2,y:l.y+Math.sin(a)*sx*l.w/2+Math.cos(a)*sy*l.h/2}};
 for(const rotation of [0,31,90,-135])for(const corner of ['nw','ne','sw','se']){
  const l={x:500,y:300,w:200,h:120,rotation},sx=corner.endsWith('e')?1:-1,sy=corner.startsWith('s')?1:-1;
  const anchor=point(l,-sx,-sy),target=point({...l,w:400,h:240},sx,sy);
  const out={...l,...resizeFromCorner(l,corner,target)},fixed=point(out,-sx,-sy);
  assert.ok(Math.abs(anchor.x-fixed.x)<1e-8&&Math.abs(anchor.y-fixed.y)<1e-8);
  assert.ok(Math.abs(out.w/out.h-l.w/l.h)<1e-8);assert.ok(out.w>l.w);
  const minimum=resizeFromCorner(l,corner,anchor);assert.equal(minimum.w,20);
 }
});
test('rotation handles angle wrap and Shift snapping',()=>{
 const l={x:0,y:0,rotation:170};
 assert.equal(rotationFromPointer(l,{x:0,y:-1},{x:1,y:0}),-100);
 assert.equal(rotationFromPointer({...l,rotation:0},{x:0,y:-1},{x:1,y:-1},true),45);
});
