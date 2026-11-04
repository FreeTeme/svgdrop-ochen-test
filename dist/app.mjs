import {objects,palettes,formats,selectObjects,validatePalette,recolor,compose,exportSvg,escapeXml} from './core.mjs';
const $=id=>document.getElementById(id);
const icon=name=>`<span class="icon" style="--icon:url('assets/icons/${name}.svg')" aria-hidden="true"></span>`;
function showPanel(panel){const focusFromContent=!!document.activeElement?.closest('main');document.body.dataset.mobilePanel=panel;document.querySelectorAll('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===panel)));if(matchMedia('(max-width:1100px)').matches)window.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(()=>{if(state)fitCanvas();if(focusFromContent&&matchMedia('(max-width:1100px)').matches){const target=$(panel==='canvas'?'workspace':panel==='library'?'library-panel':'settings-panel');target.tabIndex=-1;target.focus({preventScroll:true})}})}
function preserveFocus(key){if(key)document.querySelector(`[data-focus-key="${key}"]`)?.focus({preventScroll:true})}
let manifest=[],assets={},state,selected=null,mode='metaphor',chosen=['book','phone','puzzle'],undo=[],redo=[],drag=null,toastTimer,customPalettes=[],lastInspectorSelection=null;
const examples=[
 {title:'Знания открывают возможности',keys:['book','phone','puzzle'],paletteIndex:0,layout:'balanced',subtitle:'Обучение и новые связи'},
 {title:'Финансовый рост',keys:['wallet','coin','flowers'],paletteIndex:1,layout:'offset',subtitle:'Ценность, накопления, развитие'},
 {title:'Фокус на работе',keys:['headphones','lamp','folder'],paletteIndex:2,layout:'headline',subtitle:'Концентрация и порядок'}
];
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200)}
function download(name,data,type='application/json'){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
function snapshot(){return JSON.stringify(state)}
function remember(){undo.push(snapshot());if(undo.length>60)undo.shift();redo=[]}
function save(){try{localStorage.setItem('svgdrop-project-v1',snapshot());$('saved').textContent='Черновик сохранён'}catch{$('saved').textContent='Сохраните проект в файл'}}
function change(fn){remember();fn();render();save()}
function getAsset(l){return manifest.find(a=>a.key===l.key&&a.variant===l.variant&&a.size===state.detail)}
function initial(){const e=examples[0];return {version:1,title:e.title,format:'landscape',detail:'L',layout:e.layout,paletteIndex:0,palette:structuredClone(palettes[0]),texture:true,transparent:false,backgroundObjects:true,variation:0,layers:compose(e.keys,manifest)}}
function validateProject(p){
 if(!p||p.version!==1||!formats[p.format]||!['L','S'].includes(p.detail)||!['balanced','offset','headline'].includes(p.layout)||!Array.isArray(p.layers)||p.layers.length>50)throw Error('Неверный формат проекта SVG-drop.');
 const ids=new Set();const layers=p.layers.map(l=>{
  if(!objects.some(o=>o.key===l.key)||!['main','mono'].includes(l.variant)||!['x','y','w','h','rotation'].every(k=>Number.isFinite(l[k]))||l.w<1||l.h<1||l.w>8000||l.h>8000||Math.abs(l.x)>10000||Math.abs(l.y)>10000||Math.abs(l.rotation)>3600)throw Error('В проекте есть некорректный объект.');
  const id=typeof l.id==='string'&&/^[\w-]{1,80}$/.test(l.id)&&!ids.has(l.id)?l.id:crypto.randomUUID();ids.add(id);
  const asset=manifest.find(a=>a.key===l.key&&a.variant===l.variant&&a.size===p.detail);
  return {id,key:l.key,variant:l.variant,x:l.x,y:l.y,w:l.w,h:l.w*asset.height/asset.width,rotation:l.rotation,visible:l.visible!==false};
 });
 const palette=validatePalette(p.palette);let pi=palettes.findIndex(x=>JSON.stringify(x)===JSON.stringify(palette));if(pi<0){customPalettes=[palette];pi=3}
 return {version:1,title:String(p.title||'Композиция').slice(0,250),format:p.format,detail:p.detail,layout:p.layout,paletteIndex:pi,palette,texture:!!p.texture,transparent:!!p.transparent,backgroundObjects:!!p.backgroundObjects,variation:Number.isFinite(p.variation)?p.variation:0,layers};
}
function generate(){
 const text=$('prompt').value.trim();if(mode==='metaphor'&&!text){toast('Введите тему иллюстрации.');$('prompt').focus();return}
 if(mode==='objects'&&!chosen.length){toast('Выберите хотя бы один объект.');return}
 const pick=mode==='metaphor'?selectObjects(text):{keys:chosen};
 change(()=>{state.title=mode==='metaphor'?text:chosen.map(k=>objects.find(o=>o.key===k).name).join(', ');state.variation=0;state.layers=compose(pick.keys,manifest,state);selected=null});
 if(mode==='metaphor')$('selection-reason').textContent=pick.matched?'Подбор по смыслу: '+pick.reasons.join('; ')+'.':'Прямых совпадений в словаре нет. Базовая пара: книга и цветы — знания и рост. Вы можете заменить объекты.';
 else $('selection-reason').textContent='Композиция из выбранных объектов. Фоновые элементы добавляются отдельно.';
 showPanel('canvas');toast('Композиция собрана. Каждый объект можно редактировать.');
}
function setMode(m){mode=m;for(const k of ['metaphor','objects']){$('mode-'+k).setAttribute('aria-selected',String(k===m));$('mode-'+k).tabIndex=k===m?0:-1;$(k+'-panel').hidden=k!==m}renderChoices()}
function renderChoices(){const focused=document.activeElement?.dataset.focusKey;$('choices').replaceChildren();for(const o of objects){const b=document.createElement('button');const on=chosen.includes(o.key);b.dataset.focusKey=`choice-${o.key}`;b.innerHTML=`<img alt="" src="assets/${o.key}-main-${state.detail}.svg"><span>${o.name}</span>${on?`<span class="choice-check">${icon('check')}</span>`:''}`;b.setAttribute('aria-pressed',String(on));b.onclick=()=>{if(chosen.includes(o.key))chosen=chosen.filter(k=>k!==o.key);else if(chosen.length<4)chosen.push(o.key);else toast('В автоматической сборке можно выбрать до четырёх объектов.');renderChoices()};$('choices').append(b)}preserveFocus(focused)}
function renderLibrary(){
 const focused=document.activeElement?.dataset.focusKey;const query=$('search').value.toLowerCase().replaceAll('ё','е');const variant=$('variant').value;
 document.querySelectorAll('[data-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.variant===variant)));const rows=objects.filter(o=>(o.name+' '+o.meaning).toLowerCase().replaceAll('ё','е').includes(query));$('asset-grid').replaceChildren();$('no-assets').hidden=rows.length>0;
 for(const o of rows){const b=document.createElement('button');b.className='asset-card';b.dataset.focusKey=`asset-${o.key}-${variant}`;b.setAttribute('aria-label',`Добавить: ${o.name}, ${variant==='main'?'главный':'фоновый'} объект`);b.innerHTML=`<img alt="" src="assets/${o.key}-${variant}-${state.detail}.svg"><span class="asset-name">${o.name}</span><span class="add" aria-hidden="true">${icon('plus')}</span>`;b.onclick=()=>addObject(o.key,variant);$('asset-grid').append(b)}preserveFocus(focused);
}
function addObject(key,variant){if(state.layers.length>=50){toast('На холсте уже 50 объектов. Удалите лишние слои.');return}change(()=>{const a=getAsset({key,variant});const [W,H]=formats[state.format];const w=Math.min(W*.30,H*.40*a.width/a.height);const l={id:crypto.randomUUID(),key,variant,x:W/2,y:H/2,w,h:w*a.height/a.width,rotation:0,visible:true};state.layers.push(l);selected=l.id});showPanel('canvas');toast('Объект добавлен на холст.')}
function renderPalettes(){
 const focused=document.activeElement?.dataset.focusKey;$('palettes').replaceChildren();[...palettes,...customPalettes].forEach((p,i)=>{const b=document.createElement('button');b.className='palette';b.dataset.focusKey=`palette-${i}`;b.setAttribute('aria-label',`Палитра ${p.name}`);b.setAttribute('aria-pressed',String(i===state.paletteIndex));const sw=document.createElement('span');sw.className='palette-colors';for(const c of [p.background[0],p.background[2],p.object[0],p.object[1]]){const el=document.createElement('i');el.style.backgroundColor=c;sw.append(el)}const n=document.createElement('span');n.className='palette-name';n.textContent=p.name;if(i===state.paletteIndex)n.insertAdjacentHTML('afterbegin',icon('check'));b.append(sw,n);b.onclick=()=>change(()=>{state.paletteIndex=i;state.palette=structuredClone(p)});$('palettes').append(b)});preserveFocus(focused)
}
function fitCanvas(){const [W,H]=formats[state.format];const stage=$('artboard').parentElement;if(!stage.clientWidth||!stage.clientHeight)return;const css=getComputedStyle(stage);const sw=stage.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);const sh=stage.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom);const ratio=Math.max(.01,Math.min(sw/W,sh/H));$('artboard').style.width=W*ratio+'px';$('artboard').style.height=H*ratio+'px';renderSelection()}
function renderCanvas(){
 const focusLayer=document.activeElement?.dataset.layer;const doc=new DOMParser().parseFromString(exportSvg(state,assets,manifest),'image/svg+xml');const svg=doc.documentElement;$('canvas').setAttribute('viewBox',svg.getAttribute('viewBox'));$('canvas').replaceChildren(...[...svg.childNodes].map(n=>document.importNode(n,true)));
 for(const l of state.layers.filter(l=>l.visible)){const node=$('canvas').querySelector(`[id="${l.id}"]`);if(node){node.dataset.layer=l.id;node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label',`${getAsset(l).name}, выбрать слой`);node.setAttribute('aria-pressed',String(selected===l.id))}}
 fitCanvas();if(focusLayer)$('canvas').querySelector(`[data-layer="${focusLayer}"]`)?.focus({preventScroll:true});
}
function renderSelection(){for(const g of $('canvas').querySelectorAll('[data-layer]'))g.setAttribute('aria-pressed',String(g.dataset.layer===selected));const l=state.layers.find(l=>l.id===selected&&l.visible);$('selection-box').hidden=!l;if(!l)return;const [W,H]=formats[state.format];const b=$('selection-box');b.style.left=(l.x-l.w/2)/W*100+'%';b.style.top=(l.y-l.h/2)/H*100+'%';b.style.width=l.w/W*100+'%';b.style.height=l.h/H*100+'%';b.style.transform=`rotate(${l.rotation}deg)`}
function renderLayers(){
 const focused=document.activeElement?.dataset.focusKey;$('layers').replaceChildren();$('empty').hidden=state.layers.length>0;
 [...state.layers].reverse().forEach(l=>{const a=getAsset(l);const row=document.createElement('div');row.className='layer-row'+(l.id===selected?' active':'')+(!l.visible?' is-hidden':'');const b=document.createElement('button');b.className='layer-select';b.dataset.focusKey=`select-${l.id}`;b.innerHTML=`<img src="assets/${a.file}" alt=""><span>${a.name}</span>${l.variant==='mono'?'<small>фон</small>':''}`;b.setAttribute('aria-pressed',String(l.id===selected));b.onclick=()=>{selected=l.id;renderLayers();renderSettings();renderSelection()};const v=document.createElement('button');v.className='visibility';v.dataset.focusKey=`visibility-${l.id}`;v.innerHTML=icon(l.visible?'eye':'eye-off');v.setAttribute('aria-label',`${l.visible?'Скрыть':'Показать'} слой ${a.name}`);v.setAttribute('aria-pressed',String(l.visible));v.title=`${l.visible?'Скрыть':'Показать'} слой ${a.name}`;v.onclick=()=>change(()=>l.visible=!l.visible);row.append(b,v);$('layers').append(row)});preserveFocus(focused);
}
function renderSettings(){const l=state.layers.find(l=>l.id===selected);$('object-settings').hidden=!l;$('deselect').disabled=!l;$('edit-selected').hidden=!l;$('canvas-instruction').textContent=l?`${getAsset(l).name} — выбранный объект`:'Перемещайте объекты на холсте';if(!l)return;if(lastInspectorSelection!==l.id){lastInspectorSelection=l.id;if(matchMedia('(min-width:1101px)').matches)requestAnimationFrame(()=>$('settings-panel').scrollTop=0)}$('selected-name').textContent=getAsset(l).name;for(const [id,k] of [['scale','w'],['rotation','rotation'],['pos-x','x'],['pos-y','y']])$(id).value=Math.round(l[k]);$('backward').disabled=state.layers.indexOf(l)===0;$('forward').disabled=state.layers.indexOf(l)===state.layers.length-1}
function render(){
 $('format').value=state.format;$('detail').value=state.detail;$('layout').value=state.layout;$('background-objects').checked=state.backgroundObjects;$('texture').checked=state.texture;$('transparent').checked=state.transparent;
 const [W,H]=formats[state.format];$('dimensions').textContent=`${W} × ${H} px / ${state.detail}`;$('layer-count').textContent=`Слоёв: ${state.layers.length}`;$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;$('export').disabled=!state.layers.some(l=>l.visible);$('variation').disabled=!state.layers.some(l=>l.variant==='main');
 renderCanvas();renderLayers();renderSettings();renderLibrary();renderPalettes();renderChoices();
}
function selectedChange(fn){const l=state.layers.find(l=>l.id===selected);if(l)change(()=>fn(l))}
function duplicate(){const l=state.layers.find(l=>l.id===selected);if(!l)return;if(state.layers.length>=50){toast('Лимит — 50 слоёв.');return}change(()=>{const copy={...l,id:crypto.randomUUID(),x:l.x+30,y:l.y+30};state.layers.push(copy);selected=copy.id})}
function remove(){selectedChange(l=>{state.layers=state.layers.filter(x=>x.id!==l.id);selected=null})}
function reorder(direction){selectedChange(l=>{const i=state.layers.indexOf(l),j=Math.max(0,Math.min(state.layers.length-1,i+direction));[state.layers[i],state.layers[j]]=[state.layers[j],state.layers[i]]})}
function doUndo(){if(!undo.length)return;redo.push(snapshot());state=JSON.parse(undo.pop());selected=null;render();save()}
function doRedo(){if(!redo.length)return;undo.push(snapshot());state=JSON.parse(redo.pop());selected=null;render();save()}
function rebuild(){const keys=state.layers.filter(l=>l.variant==='main').map(l=>l.key);state.layers=compose(keys,manifest,state);selected=null}
function renderExamples(){
 $('example-grid').replaceChildren();for(const [index,e] of examples.entries()){const b=document.createElement('button');b.className='example-card';const demo={...initial(),...e,palette:palettes[e.paletteIndex],layers:compose(e.keys,manifest,{layout:e.layout})};const art=exportSvg(demo,assets,manifest).replace(/<\?xml.*?\?>/,'').replace(/\bid="([^"]+)"/g,(_,id)=>`id="example-${index}-${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#example-${index}-${id})`);b.innerHTML=`<span class="example-art" aria-hidden="true">${art}</span><strong>${escapeXml(e.title)}</strong><small>${e.subtitle}</small>`;b.onclick=()=>{change(()=>{state={...demo,layers:structuredClone(demo.layers),palette:structuredClone(demo.palette)};selected=null});$('prompt').value=e.title;$('selection-reason').textContent='Пример из исходных векторов. Настройте его под свою историю.';showPanel('canvas')};$('example-grid').append(b)}
}
$('mode-metaphor').onclick=()=>setMode('metaphor');$('mode-objects').onclick=()=>setMode('objects');$('generate').onclick=generate;
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('prompt').value=b.dataset.prompt;generate()});
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>showPanel(b.dataset.panel));
document.querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>{$('variant').value=b.dataset.variant;renderLibrary()});
$('edit-selected').onclick=()=>showPanel('settings');
document.querySelector('[aria-label="Способ сборки"]').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'metaphor':e.key==='End'?'objects':mode==='metaphor'?'objects':'metaphor';setMode(next);$('mode-'+next).focus()});
document.querySelector('.skip-link').onclick=e=>{e.preventDefault();showPanel('canvas');$('workspace').focus()};
$('search').oninput=renderLibrary;$('variant').onchange=renderLibrary;
$('layout').onchange=()=>change(()=>{state.layout=$('layout').value;rebuild()});
$('format').onchange=()=>change(()=>{const [oldW,oldH]=formats[state.format];state.format=$('format').value;const [W,H]=formats[state.format];const s=Math.min(W/oldW,H/oldH);state.layers.forEach(l=>{l.x=l.x/oldW*W;l.y=l.y/oldH*H;l.w*=s;l.h*=s});selected=null});
$('detail').onchange=()=>change(()=>{state.detail=$('detail').value;state.layers.forEach(l=>{const a=getAsset(l);l.h=l.w*a.height/a.width})});
$('background-objects').onchange=()=>change(()=>{state.backgroundObjects=$('background-objects').checked;if(!state.backgroundObjects)state.layers=state.layers.filter(l=>l.variant!=='mono');else{const layers=compose(state.layers.filter(l=>l.variant==='main').map(l=>l.key).slice(0,4),manifest,state);state.layers.unshift(...layers.filter(l=>l.variant==='mono').map(l=>({...l,id:crypto.randomUUID()})))}});
for(const id of ['texture','transparent'])$(id).onchange=()=>change(()=>state[id]=$(id).checked);
$('variation').onclick=()=>change(()=>{state.variation++;rebuild()});$('undo').onclick=doUndo;$('redo').onclick=doRedo;
$('deselect').onclick=()=>{selected=null;renderLayers();renderSettings();renderSelection()};
for(const [id,key] of [['scale','w'],['rotation','rotation'],['pos-x','x'],['pos-y','y']])$(id).onchange=()=>{
 const value=Number($(id).value);if(!Number.isFinite(value))return;selectedChange(l=>{if(key==='w'){l.w=Math.max(20,Math.min(4000,value));const a=getAsset(l);l.h=l.w*a.height/a.width}else l[key]=Math.max(key==='rotation'?-180:-4000,Math.min(key==='rotation'?180:8000,value))})
};
$('backward').onclick=()=>reorder(-1);$('forward').onclick=()=>reorder(1);$('duplicate').onclick=duplicate;$('delete').onclick=remove;
$('clear').onclick=()=>{if(!state.layers.length)return;change(()=>{state.layers=[];selected=null});toast('Холст очищен. Действие можно отменить.')};
$('export').onclick=()=>{download('svgdrop-composition.svg',exportSvg(state,assets,manifest),'image/svg+xml');toast('SVG экспортирован с отдельными векторными слоями.')};
$('save-project').onclick=()=>download('svgdrop-project.json',JSON.stringify(state,null,2));$('open-project').onclick=()=>$('project-file').click();
$('project-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1e6)throw Error('Проект слишком большой. Максимум 1 МБ.');const p=validateProject(JSON.parse(await file.text()));change(()=>{state=p;selected=null});$('prompt').value=state.title;toast('Проект открыт.')}catch(err){toast('Не удалось открыть проект: '+err.message)}e.target.value=''};
$('upload-palette').onclick=()=>$('palette-file').click();$('palette-template').onclick=()=>download('svgdrop-palette.json',JSON.stringify(palettes[0],null,2));
$('palette-file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>10000)throw Error('Максимальный размер палитры — 10 КБ.');const p=validatePalette(JSON.parse(await f.text()));change(()=>{customPalettes.push(p);state.paletteIndex=3+customPalettes.length-1;state.palette=p});toast('Палитра применена ко всем объектам.')}catch(err){toast('Палитра не загружена: '+err.message)}e.target.value=''};
$('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();
$('canvas').addEventListener('pointerdown',e=>{
 const g=e.target.closest('[data-layer]');if(!g){selected=null;renderLayers();renderSettings();renderSelection();return}
 selected=g.dataset.layer;const l=state.layers.find(l=>l.id===selected);renderLayers();renderSettings();renderSelection();drag={id:l.id,startX:e.clientX,startY:e.clientY,x:l.x,y:l.y,before:snapshot(),moved:false};$('canvas').setPointerCapture(e.pointerId);e.preventDefault();
});
$('canvas').addEventListener('pointermove',e=>{if(!drag)return;const l=state.layers.find(l=>l.id===drag.id);const r=$('canvas').getBoundingClientRect(),[W,H]=formats[state.format];const dx=(e.clientX-drag.startX)*W/r.width,dy=(e.clientY-drag.startY)*H/r.height;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;l.x=Math.max(0,Math.min(W,drag.x+dx));l.y=Math.max(0,Math.min(H,drag.y+dy));$('canvas').querySelector(`[id="${l.id}"]`)?.setAttribute('transform',`translate(${l.x} ${l.y}) rotate(${l.rotation})`);renderSelection();renderSettings()});
function finishDrag(){if(!drag)return;if(drag.moved){undo.push(drag.before);redo=[];render();save()}drag=null}
$('canvas').addEventListener('pointerup',finishDrag);$('canvas').addEventListener('pointercancel',finishDrag);
$('canvas').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const g=e.target.closest('[data-layer]');if(g){selected=g.dataset.layer;renderLayers();renderSettings();renderSelection();e.preventDefault()}}});
document.addEventListener('keydown',e=>{
 if(e.target.closest('input,textarea,select,dialog,[role=tablist],.responsive-tools')||!state)return;
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?doRedo():doUndo();return}
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();return}
 if(e.key==='Escape'){$('deselect').click();return}if(!selected)return;
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove()}
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const d=e.shiftKey?10:1;selectedChange(l=>{if(e.key==='ArrowUp')l.y-=d;if(e.key==='ArrowDown')l.y+=d;if(e.key==='ArrowLeft')l.x-=d;if(e.key==='ArrowRight')l.x+=d})}
});
window.addEventListener('resize',()=>state&&fitCanvas());
new ResizeObserver(()=>state&&fitCanvas()).observe(document.querySelector('.canvas-stage'));
async function boot(){try{
 $('load-error').hidden=true;$('loading').hidden=false;const m=await fetch('assets/manifest.json');if(!m.ok)throw Error('manifest');manifest=await m.json();
 const entries=await Promise.all([...manifest.map(a=>[a.id,'assets/'+a.file]),...[0,1,2].flatMap(i=>['S','L'].map(s=>[`background-${i}-${s}`,`assets/background-${i}-${s}.svg`]))].map(async([id,path])=>{const r=await fetch(path);if(!r.ok)throw Error(path);return [id,await r.text()]}));assets=Object.fromEntries(entries);state=initial();
 try{const saved=localStorage.getItem('svgdrop-project-v1');if(saved)state=validateProject(JSON.parse(saved))}catch{toast('Начинаем новый черновик: сохранённый проект недоступен.')}
 $('loading').hidden=true;$('app').hidden=false;$('prompt').value=state.title;renderExamples();render();$('selection-reason').textContent='В библиотеке — десять предметов и их фоновые версии. Новые объекты не генерируются.';save();
}catch(err){$('loading').hidden=true;$('load-error').hidden=false;console.error('Library load failed',err)}}
$('retry').onclick=boot;boot();
