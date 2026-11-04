export const objects = [
  ['book','Книга','знания, обучение, история','учеб|учит|знан|образован|книг|чтен|курс|экзам|learning|study|book|education'],
  ['phone','Телефон','связь, технологии, навигация','связ|общени|технолог|цифр|прилож|телефон|онлайн|digital|phone|connect'],
  ['puzzle','Пазлы','команда, решение, сотрудничество','команд|вместе|решени|сотруд|собра|пазл|партнер|team|puzzle|solution'],
  ['coin','Монета','накопления, ценность, результат','деньг|финанс|сбереж|монет|инвест|ценност|богат|бюджет|money|saving|finance'],
  ['headphones','Наушники','фокус, музыка, отдых','фокус|музык|слуш|подкаст|звук|отдых|науш|focus|music|audio'],
  ['lamp','Лампа','идея, открытие, работа','иде|свет|вдохнов|работ|открыти|ламп|idea|light|work'],
  ['folder','Папка','порядок, документы, планирование','поряд|документ|план|проект|папк|организ|задач|project|plan|folder'],
  ['pen','Ручка','творчество, письмо, начало','твор|пис|начал|замет|ручк|автор|дизайн|write|creativ|design'],
  ['wallet','Кошелёк','покупки, платежи, личные финансы','покуп|кошел|плат|трат|эконом|покуп|wallet|pay|shop'],
  ['flowers','Цветы','рост, забота, развитие','рост|развит|забот|цвет|природ|гармон|баланс|grow|care|flower']
].map(([key,name,meaning,pattern])=>({key,name,meaning,pattern}));
export const palettes = [
 {name:'Лаванда',background:['#D7CDF5','#AA9BF0','#7864D7'],object:['#F9ECB0','#F9A3AA','#FFE3E1'],ink:'#181817',paper:'#FFFFFF'},
 {name:'Персик',background:['#FDD7B9','#FAC896','#D27532'],object:['#F9ECB0','#80DADA','#BEEBEB'],ink:'#181817',paper:'#FFFFFF'},
 {name:'Мята',background:['#BEEBEB','#80DADA','#5ABEBE'],object:['#FFD4F2','#6D7BFC','#B6C6FE'],ink:'#181817',paper:'#FFFFFF'}
];
export const formats = {'landscape':[1200,630],'square':[1080,1080],'portrait':[1080,1920],'wide':[1600,600]};
export function selectObjects(text){
 const input=text.toLowerCase().replaceAll('ё','е');
 const ranked=objects.map((o,i)=>({...o,score:(input.match(new RegExp(o.pattern,'g'))||[]).length,i})).filter(o=>o.score).sort((a,b)=>b.score-a.score||a.i-b.i);
 const matched=ranked.slice(0,4).map(o=>o.key);
 return {keys:matched.length?matched:['book','flowers'],matched:!!matched.length,reasons:ranked.slice(0,4).map(o=>`${o.name}: ${o.meaning}`)};
}
export function validatePalette(p){
 if(!p||typeof p.name!=='string'||p.name.length>50||!Array.isArray(p.background)||p.background.length!==3||!Array.isArray(p.object)||p.object.length!==3)throw Error('Нужны name, background[3] и object[3].');
 const hex=/^#[0-9a-f]{6}$/i;
 if(![...p.background,...p.object,p.ink||'#181817',p.paper||'#FFFFFF'].every(x=>typeof x==='string'&&hex.test(x)))throw Error('Цвета должны быть в формате #RRGGBB.');
 return {name:p.name,background:[...p.background],object:[...p.object],ink:p.ink||'#181817',paper:p.paper||'#FFFFFF'};
}
export function recolor(svg,p){
 const base=palettes[0];const from=[...base.background,...base.object,base.ink,base.paper];const to=[...p.background,...p.object,p.ink,p.paper];
 return svg.replace(/#[0-9a-f]{6}\b|\bwhite\b|\bblack\b/gi,c=>{const k=from.findIndex(x=>x.toLowerCase()===(c==='white'?'#ffffff':c==='black'?'#181817':c.toLowerCase()));return k<0?c:to[k]});
}
export function compose(keys,manifest,{format='landscape',detail='L',layout='balanced',backgroundObjects=true,variation=0}={}){
 if(!keys.length)return [];
 const [W,H]=formats[format]; const m=keys;const n=m.length;let uid=1;
 const proportions=n===1?[[.52,.55,.62]]:n===2?[[.38,.60,.51],[.73,.42,.38]]:n===3?[[.42,.61,.50],[.77,.51,.34],[.70,.23,.25]]:[[.37,.60,.45],[.73,.58,.34],[.71,.22,.25],[.30,.22,.24]];
 const layers=m.map((key,i)=>{
  const a=manifest.find(x=>x.key===key&&x.size===detail&&x.variant==='main');let [cx,cy,size]=proportions[i%4];
  if(format==='portrait'){cx=[.40,.70,.35,.69][i%4];cy=[.61,.40,.22,.80][i%4];size=[.66,.44,.38,.35][i%4]}
  if(n>4){const cols=Math.ceil(Math.sqrt(n*W/H)),rows=Math.ceil(n/cols);cx=(i%cols+.5)/cols;cy=(Math.floor(i/cols)+.5)/rows;size=.84/cols}
  if(layout==='offset'){cx+=i%2?.03:-.04;cy+=i%2?-.03:.02}
  if(layout==='headline'){cx=.56+cx*.40;cy=.18+cy*.70;size*=.78}
  const heightLimit=n>4?H*.84/Math.ceil(n/Math.ceil(Math.sqrt(n*W/H))):H*.64;
  const w=Math.min(W*size,heightLimit*a.width/a.height);const h=w*a.height/a.width;
  return {id:`layer-${uid++}`,key,variant:'main',x:cx*W,y:cy*H,w,h,rotation:variation?[-5,7,-9,4][(i+variation)%4]:0,visible:true};
 });
 if(backgroundObjects){
  const used=new Set(m);const extras=objects.filter(o=>!used.has(o.key));
  for(let i=0;i<Math.min(2,extras.length);i++){
   const key=extras[(i+variation)%extras.length].key;const a=manifest.find(x=>x.key===key&&x.size===detail&&x.variant==='mono');const w=W*(format==='portrait'?.40:.22);const h=w*a.height/a.width;
   layers.unshift({id:`layer-${uid++}`,key,variant:'mono',x:W*(i?.84:.18),y:H*(i?.77:.22),w,h,rotation:0,visible:true});
  }
 }
 return layers.map(l=>({...l,x:Math.max(l.w/2,Math.min(W-l.w/2,l.x)),y:Math.max(l.h/2,Math.min(H-l.h/2,l.y))}));
}
export function escapeXml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
export function svgInner(s){return s.replace(/^.*?<svg\b[^>]*>/s,'').replace(/<\/svg>\s*$/,'')}
export function exportSvg(state,assets,manifest){
 const [w,h]=formats[state.format];const p=state.palette;
 let body=state.transparent?'':`<rect width="${w}" height="${h}" fill="${p.background[0]}"/>`;
 if(state.texture&&!state.transparent){const raw=assets[`background-${state.paletteIndex<3?state.paletteIndex:0}-${state.detail}`];if(raw){let parsed=raw.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);let [x,y,bw,bh]=parsed;let content=state.paletteIndex>=3?recolor(raw,p):raw;body+=`<svg width="${w}" height="${h}" viewBox="${x} ${y} ${bw} ${bh}" preserveAspectRatio="none">${svgInner(content)}</svg>`}}
 for(const l of state.layers.filter(l=>l.visible)){
  const a=manifest.find(a=>a.key===l.key&&a.variant===l.variant&&a.size===state.detail);const raw=assets[a.id];
  body+=`<g id="${escapeXml(l.id)}" aria-label="${escapeXml(a.name)}" transform="translate(${l.x} ${l.y}) rotate(${l.rotation})"><svg x="${-l.w/2}" y="${-l.h/2}" width="${l.w}" height="${l.h}" viewBox="0 0 ${a.width} ${a.height}">${svgInner(recolor(raw,p))}</svg></g>`;
 }
 return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none"><title>${escapeXml(state.title||'Векторная композиция')}</title>${body}</svg>`;
}
