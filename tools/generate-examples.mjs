import fs from 'node:fs';
import {compose,palettes,exportSvg} from '../dist/core.mjs';
const base=new URL('../',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('dist/assets/manifest.json',base)));
const assets=Object.fromEntries(manifest.map(a=>[a.id,fs.readFileSync(new URL('dist/assets/'+a.file,base),'utf8')]));
for(let i=0;i<3;i++)for(const s of ['S','L'])assets[`background-${i}-${s}`]=fs.readFileSync(new URL(`dist/assets/background-${i}-${s}.svg`,base),'utf8');
const examples=[['01-learning','Знания открывают возможности',['book','phone','puzzle'],0,'balanced'],['02-finance','Финансовый рост',['wallet','coin','flowers'],1,'offset'],['03-focus','Фокус на работе',['headphones','lamp','folder'],2,'headline']];
fs.mkdirSync(new URL('examples/',base),{recursive:true});
for(const [name,title,keys,paletteIndex,layout] of examples){const state={version:1,title,format:'landscape',detail:'L',layout,paletteIndex,palette:palettes[paletteIndex],texture:true,transparent:false,backgroundObjects:true,variation:0,layers:compose(keys,manifest,{layout})};fs.writeFileSync(new URL(`examples/${name}.svg`,base),exportSvg(state,assets,manifest));fs.writeFileSync(new URL(`examples/${name}.json`,base),JSON.stringify(state,null,2))}
console.log('Three SVG examples and editable JSON projects written.');
