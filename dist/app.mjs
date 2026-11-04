import {resizeFromCorner, rotationFromPointer} from './transforms.mjs';
import {enhanceSelects, syncSelects} from './selects.mjs';
import {objects,palettes,formats,selectObjects,validatePalette,recolor,compose,exportSvg,escapeXml} from './core.mjs';
const $=id=>document.getElementById(id);
const icon=name=>`<span class="icon" style="--icon:url('assets/icons/${name}.svg')" aria-hidden="true"></span>`;
function showPanel(panel){const focusFromContent=!!document.activeElement?.closest('main');document.body.dataset.mobilePanel=panel;document.querySelectorAll('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===panel)));if(matchMedia('(max-width:1100px)').matches)window.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(()=>{if(state)fitCanvas();if(focusFromContent&&matchMedia('(max-width:1100px)').matches){const target=$(panel==='canvas'?'workspace':panel==='library'?'library-panel':'settings-panel');target.tabIndex=-1;target.focus({preventScroll:true})}})}
function preserveFocus(key){if(key)document.querySelector(`[data-focus-key="${key}"]`)?.focus({preventScroll:true})}
let manifest=[],assets={},state,selected=null,mode='metaphor',undo=[],redo=[],drag=null,toastTimer,customPalettes=[],lastInspectorSelection=null;
const examples=[
 {title:'Знания открывают возможности',keys:['book','phone','puzzle'],paletteIndex:0,layout:'balanced',subtitle:'Обучение и новые связи'},
 {title:'Финансовый рост',keys:['wallet','coin','flowers'],paletteIndex:1,layout:'offset',subtitle:'Ценность, накопления, развитие'},
 {title:'Фокус на работе',keys:['headphones','lamp','folder'],paletteIndex:2,layout:'headline',subtitle:'Концентрация и порядок'}
];
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200)}
function download(name,data,type='application/json'){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
function snapshot(){return JSON.stringify(state)}
function remember(){undo.push(snapshot());if(undo.length>60)undo.shift();redo=[]}
function save(){try{localStorage.setItem('svgdrop-project-v1',snapshot())}catch{toast('Не удалось сохранить черновик. Сохраните проект в файл.')}}
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
 const text=$('prompt').value.trim();if(!text){toast('Введите тему иллюстрации.');$('prompt').focus();return}
 const pick=selectObjects(text);
 change(()=>{state.title=text;state.variation=0;state.layers=compose(pick.keys,manifest,state);selected=null});
 showPanel('canvas');toast(pick.matched?'Композиция собрана. Каждый объект можно редактировать.':'Прямых совпадений нет. Добавлены книга и цветы; замените их во вкладке «Из объектов».');
}
function setMode(m){mode=m;for(const k of ['metaphor','objects']){$('mode-'+k).setAttribute('aria-selected',String(k===m));$('mode-'+k).tabIndex=k===m?0:-1;$(k+'-panel').hidden=k!==m}$('generate').hidden=m==='objects';$('library-panel').scrollTop=0;renderChoices()}
function renderChoices(){
 const focused=document.activeElement?.dataset.focusKey;$('choices').replaceChildren();
 for(const o of objects){const b=document.createElement('button');b.className='asset-card';b.dataset.focusKey=`choice-${o.key}`;b.dataset.object=o.key;b.draggable=true;b.title='Нажмите или перетащите на холст';b.setAttribute('aria-label',`Добавить на холст: ${o.name}`);b.innerHTML=`<img alt="" draggable="false" src="assets/${o.key}-main-${state.detail}.svg"><span>${o.name}</span><span class="add" aria-hidden="true">${icon('plus')}</span>`;
 b.onclick=()=>addObject(o.key,'main');b.ondragstart=e=>{e.dataTransfer.setData('application/x-svgdrop-object',o.key);e.dataTransfer.effectAllowed='copy';document.body.classList.add('dragging-object')};b.ondragend=()=>{document.body.classList.remove('dragging-object');$('artboard').classList.remove('drop-active')};$('choices').append(b)}preserveFocus(focused)
}
function addObject(key,variant,point){if(state.layers.length>=50){toast('На холсте уже 50 объектов. Удалите лишние слои.');return}change(()=>{const a=getAsset({key,variant});const [W,H]=formats[state.format];const w=Math.min(W*.30,H*.40*a.width/a.height);const l={id:crypto.randomUUID(),key,variant,x:point?.x??W/2,y:point?.y??H/2,w,h:w*a.height/a.width,rotation:0,visible:true};state.layers.push(l);state.backgroundObjects=false;selected=l.id});showPanel('canvas');toast('Объект добавлен. Тяните углы рамки для изменения размера.')}
function deselect(){selected=null;renderLayers();renderSettings();renderSelection()}
function renderPalettes(){
 const focused=document.activeElement?.dataset.focusKey;$('palettes').replaceChildren();[...palettes,...customPalettes].forEach((p,i)=>{const b=document.createElement('button');b.className='palette';b.dataset.focusKey=`palette-${i}`;b.setAttribute('aria-label',`Палитра ${p.name}`);b.setAttribute('aria-pressed',String(i===state.paletteIndex));const sw=document.createElement('span');sw.className='palette-colors';for(const c of [p.background[0],p.background[2],p.object[0],p.object[1]]){const el=document.createElement('i');el.style.backgroundColor=c;sw.append(el)}const n=document.createElement('span');n.className='palette-name';n.textContent=p.name;if(i===state.paletteIndex)n.insertAdjacentHTML('afterbegin',icon('check'));b.append(sw,n);b.onclick=()=>change(()=>{state.paletteIndex=i;state.palette=structuredClone(p)});$('palettes').append(b)});preserveFocus(focused)
}
function fitCanvas(){const [W,H]=formats[state.format];const stage=$('artboard').parentElement;if(!stage.clientWidth||!stage.clientHeight)return;const css=getComputedStyle(stage);const sw=stage.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);const sh=stage.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom);const ratio=Math.max(.01,Math.min(sw/W,sh/H));$('artboard').style.width=W*ratio+'px';$('artboard').style.height=H*ratio+'px';renderSelection()}
function renderCanvas(){
 const focusLayer=document.activeElement?.dataset.layer;const doc=new DOMParser().parseFromString(exportSvg(state,assets,manifest),'image/svg+xml');const svg=doc.documentElement;$('canvas').setAttribute('viewBox',svg.getAttribute('viewBox'));$('canvas').replaceChildren(...[...svg.childNodes].map(n=>document.importNode(n,true)));
 for(const l of state.layers.filter(l=>l.visible)){const node=$('canvas').querySelector(`[id="${l.id}"]`);if(node){node.dataset.layer=l.id;node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label',`${getAsset(l).name}, выбрать слой`);node.setAttribute('aria-pressed',String(selected===l.id))}}
 fitCanvas();if(focusLayer)$('canvas').querySelector(`[data-layer="${focusLayer}"]`)?.focus({preventScroll:true});
}
function renderSelection(){
 for(const g of $('canvas').querySelectorAll('[data-layer]'))g.setAttribute('aria-pressed',String(g.dataset.layer===selected));
 const l=state.layers.find(l=>l.id===selected&&l.visible);$('selection-box').hidden=!l;$('object-toolbar').hidden=!l;if(!l)return;
 const [W,H]=formats[state.format];const b=$('selection-box');b.style.left=(l.x-l.w/2)/W*100+'%';b.style.top=(l.y-l.h/2)/H*100+'%';b.style.width=l.w/W*100+'%';b.style.height=l.h/H*100+'%';b.style.transform=`rotate(${l.rotation}deg)`;
 const board=$('artboard'),r=board.getBoundingClientRect(),a=l.rotation*Math.PI/180;
 const halfH=(Math.abs(Math.sin(a))*l.w+Math.abs(Math.cos(a))*l.h)/2/H*r.height;
 const x=l.x/W*r.width,y=l.y/H*r.height,t=$('object-toolbar');
 t.style.left=Math.max(48,Math.min(r.width-48,x))+'px';t.style.top=Math.max(8,y-halfH-90)+'px';
}
function renderLayers(){
 const focused=document.activeElement?.dataset.focusKey;$('layers').replaceChildren();$('empty').hidden=state.layers.length>0;
 [...state.layers].reverse().forEach(l=>{const a=getAsset(l);const row=document.createElement('div');row.className='layer-row'+(l.id===selected?' active':'')+(!l.visible?' is-hidden':'');const b=document.createElement('button');b.className='layer-select';b.dataset.focusKey=`select-${l.id}`;b.innerHTML=`<img src="assets/${a.file}" alt=""><span>${a.name}</span>${l.variant==='mono'?'<small>фон</small>':''}`;b.setAttribute('aria-pressed',String(l.id===selected));b.onclick=()=>{selected=l.id;renderLayers();renderSettings();renderSelection()};const v=document.createElement('button');v.className='visibility';v.dataset.focusKey=`visibility-${l.id}`;v.innerHTML=icon(l.visible?'eye':'eye-off');v.setAttribute('aria-label',`${l.visible?'Скрыть':'Показать'} слой ${a.name}`);v.setAttribute('aria-pressed',String(l.visible));v.title=`${l.visible?'Скрыть':'Показать'} слой ${a.name}`;v.onclick=()=>change(()=>l.visible=!l.visible);row.append(b,v);$('layers').append(row)});preserveFocus(focused);
}
function renderSettings(){const l=state.layers.find(l=>l.id===selected);$('object-settings').hidden=!l;$('edit-selected').hidden=!l;$('canvas-instruction').textContent=l?`${getAsset(l).name} — выбранный объект`:'Перемещайте объекты на холсте';if(!l)return;if(lastInspectorSelection!==l.id){lastInspectorSelection=l.id;if(matchMedia('(min-width:1101px)').matches)requestAnimationFrame(()=>$('settings-panel').scrollTop=0)}$('selected-name').textContent=getAsset(l).name;for(const [id,k] of [['scale','w'],['rotation','rotation'],['pos-x','x'],['pos-y','y']])$(id).value=Math.round(l[k]);$('backward').disabled=state.layers.indexOf(l)===0;$('forward').disabled=state.layers.indexOf(l)===state.layers.length-1}
function render(){
 $('format').value=state.format;$('detail').value=state.detail;$('layout').value=state.layout;$('background-objects').checked=state.backgroundObjects;$('texture').checked=state.texture;$('transparent').checked=state.transparent;
 const [W,H]=formats[state.format];$('dimensions').textContent=`${W} × ${H} px / ${state.detail}`;$('layer-count').textContent=`Слоёв: ${state.layers.length}`;$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;$('export').disabled=!state.layers.some(l=>l.visible);$('variation').disabled=!state.layers.some(l=>l.variant==='main');
 renderCanvas();renderLayers();renderSettings();renderPalettes();renderChoices();syncSelects();
}
function selectedChange(fn){const l=state.layers.find(l=>l.id===selected);if(l)change(()=>fn(l))}
function duplicate(){const l=state.layers.find(l=>l.id===selected);if(!l)return;if(state.layers.length>=50){toast('Лимит — 50 слоёв.');return}change(()=>{const copy={...l,id:crypto.randomUUID(),x:l.x+30,y:l.y+30};state.layers.push(copy);selected=copy.id})}
function remove(){selectedChange(l=>{state.layers=state.layers.filter(x=>x.id!==l.id);selected=null})}
function reorder(direction){selectedChange(l=>{const i=state.layers.indexOf(l),j=Math.max(0,Math.min(state.layers.length-1,i+direction));[state.layers[i],state.layers[j]]=[state.layers[j],state.layers[i]]})}
function doUndo(){if(!undo.length)return;redo.push(snapshot());state=JSON.parse(undo.pop());selected=null;render();save()}
function doRedo(){if(!redo.length)return;undo.push(snapshot());state=JSON.parse(redo.pop());selected=null;render();save()}
function rebuild(){const keys=state.layers.filter(l=>l.variant==='main').map(l=>l.key);state.layers=compose(keys,manifest,state);selected=null}
function renderExamples(){
 $('example-grid').replaceChildren();for(const [index,e] of examples.entries()){const b=document.createElement('button');b.className='example-card';const demo={...initial(),...e,palette:palettes[e.paletteIndex],layers:compose(e.keys,manifest,{layout:e.layout})};const art=exportSvg(demo,assets,manifest).replace(/<\?xml.*?\?>/,'').replace(/\bid="([^"]+)"/g,(_,id)=>`id="example-${index}-${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#example-${index}-${id})`);b.innerHTML=`<span class="example-art" aria-hidden="true">${art}</span><strong>${escapeXml(e.title)}</strong><small>${e.subtitle}</small>`;b.onclick=()=>{change(()=>{state={...demo,layers:structuredClone(demo.layers),palette:structuredClone(demo.palette)};selected=null});$('prompt').value=e.title;showPanel('canvas')};$('example-grid').append(b)}
}
$('mode-metaphor').onclick=()=>setMode('metaphor');$('mode-objects').onclick=()=>setMode('objects');$('generate').onclick=generate;
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('prompt').value=b.dataset.prompt;generate()});
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>showPanel(b.dataset.panel));
$('edit-selected').onclick=()=>showPanel('settings');
document.querySelector('[aria-label="Способ сборки"]').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'metaphor':e.key==='End'?'objects':mode==='metaphor'?'objects':'metaphor';setMode(next);$('mode-'+next).focus()});
document.querySelector('.skip-link').onclick=e=>{e.preventDefault();showPanel('canvas');$('workspace').focus()};

$('layout').onchange=()=>change(()=>{state.layout=$('layout').value;rebuild()});
$('format').onchange=()=>change(()=>{const [oldW,oldH]=formats[state.format];state.format=$('format').value;const [W,H]=formats[state.format];const s=Math.min(W/oldW,H/oldH);state.layers.forEach(l=>{l.x=l.x/oldW*W;l.y=l.y/oldH*H;l.w*=s;l.h*=s});selected=null});
$('detail').onchange=()=>change(()=>{state.detail=$('detail').value;state.layers.forEach(l=>{const a=getAsset(l);l.h=l.w*a.height/a.width})});
$('background-objects').onchange=()=>change(()=>{state.backgroundObjects=$('background-objects').checked;if(!state.backgroundObjects)state.layers=state.layers.filter(l=>l.variant!=='mono');else{const layers=compose(state.layers.filter(l=>l.variant==='main').map(l=>l.key).slice(0,4),manifest,state);state.layers.unshift(...layers.filter(l=>l.variant==='mono').map(l=>({...l,id:crypto.randomUUID()})))}});
for(const id of ['texture','transparent'])$(id).onchange=()=>change(()=>state[id]=$(id).checked);
$('variation').onclick=()=>change(()=>{state.variation++;rebuild()});$('undo').onclick=doUndo;$('redo').onclick=doRedo;
$('canvas-delete').onclick=remove;$('canvas-duplicate').onclick=duplicate;$('manual-clear').onclick=()=>$('clear').click();
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
function canvasPoint(e){const r=$('canvas').getBoundingClientRect(),[W,H]=formats[state.format];return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
function beginTransform(e,kind,handle){const l=state.layers.find(l=>l.id===selected);if(!l||e.button!==0)return;drag={id:l.id,kind,handle,point:canvasPoint(e),original:{...l},before:snapshot(),moved:false,pointerId:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault()}
$('canvas').addEventListener('pointerdown',e=>{
 const g=e.target.closest('[data-layer]');if(!g){deselect();return}selected=g.dataset.layer;renderLayers();renderSettings();renderSelection();beginTransform(e,'move');
});
$('selection-box').addEventListener('pointerdown',e=>{const h=e.target.closest('[data-handle]');if(h)beginTransform(e,h.dataset.handle==='rotate'?'rotate':'resize',h.dataset.handle)});
document.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.pointerId)return;const l=state.layers.find(l=>l.id===drag.id);if(!l)return;const p=canvasPoint(e),o=drag.original,dx=p.x-drag.point.x,dy=p.y-drag.point.y,[W,H]=formats[state.format];
 if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;if(!drag.moved)return;
 if(drag.kind==='move'){l.x=Math.max(0,Math.min(W,o.x+dx));l.y=Math.max(0,Math.min(H,o.y+dy))}
 else if(drag.kind==='resize')Object.assign(l,resizeFromCorner(o,drag.handle,p));
 else l.rotation=rotationFromPointer(o,drag.point,p,e.shiftKey);
 const node=$('canvas').querySelector(`[id="${l.id}"]`);node?.setAttribute('transform',`translate(${l.x} ${l.y}) rotate(${l.rotation})`);const inner=node?.querySelector('svg');if(inner)for(const [k,v] of Object.entries({x:-l.w/2,y:-l.h/2,width:l.w,height:l.h}))inner.setAttribute(k,v);
 renderSelection();renderSettings();
});
function finishDrag(e){if(!drag||e.pointerId!==drag.pointerId)return;const d=drag;drag=null;if(e.type==='pointercancel'){state=JSON.parse(d.before);render();return}if(d.moved){undo.push(d.before);if(undo.length>60)undo.shift();redo=[];render();save()}}
document.addEventListener('pointerup',finishDrag);document.addEventListener('pointercancel',finishDrag);
for(const h of document.querySelectorAll('[data-handle]'))h.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();const sign=['ArrowUp','ArrowRight'].includes(e.key)?1:-1;selectedChange(l=>{if(h.dataset.handle==='rotate')l.rotation=normalizeRotation(l.rotation+sign*(e.shiftKey?15:1));else{const ratio=l.h/l.w;l.w=Math.max(20,Math.min(4000,l.w+sign*(e.shiftKey?50:10)));l.h=l.w*ratio}})});
function normalizeRotation(deg){return ((deg+180)%360+360)%360-180}
const board=$('artboard');board.addEventListener('dragover',e=>{if(!e.dataTransfer.types.includes('application/x-svgdrop-object'))return;e.preventDefault();e.dataTransfer.dropEffect='copy';board.classList.add('drop-active')});board.addEventListener('dragleave',e=>{if(!board.contains(e.relatedTarget))board.classList.remove('drop-active')});board.addEventListener('drop',e=>{e.preventDefault();board.classList.remove('drop-active');document.body.classList.remove('dragging-object');const key=e.dataTransfer.getData('application/x-svgdrop-object');if(objects.some(o=>o.key===key)){const p=canvasPoint(e),[W,H]=formats[state.format];addObject(key,'main',{x:Math.max(0,Math.min(W,p.x)),y:Math.max(0,Math.min(H,p.y))})}});
$('canvas').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const g=e.target.closest('[data-layer]');if(g){selected=g.dataset.layer;renderLayers();renderSettings();renderSelection();e.preventDefault()}}});
document.addEventListener('keydown',e=>{
 if(e.target.closest('input,textarea,select,dialog,[role=tablist],.responsive-tools,[role=listbox],[role=combobox]')||!state)return;
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?doRedo():doUndo();return}
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();return}
 if(e.key==='Escape'){deselect();return}if(!selected)return;
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove()}
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const d=e.shiftKey?10:1;selectedChange(l=>{if(e.key==='ArrowUp')l.y-=d;if(e.key==='ArrowDown')l.y+=d;if(e.key==='ArrowLeft')l.x-=d;if(e.key==='ArrowRight')l.x+=d})}
});
window.addEventListener('resize',()=>state&&fitCanvas());
new ResizeObserver(()=>state&&fitCanvas()).observe(document.querySelector('.canvas-stage'));
async function boot(){try{
 $('load-error').hidden=true;$('loading').hidden=false;const m=await fetch('assets/manifest.json');if(!m.ok)throw Error('manifest');manifest=await m.json();
 const entries=await Promise.all([...manifest.map(a=>[a.id,'assets/'+a.file]),...[0,1,2].flatMap(i=>['S','L'].map(s=>[`background-${i}-${s}`,`assets/background-${i}-${s}.svg`]))].map(async([id,path])=>{const r=await fetch(path);if(!r.ok)throw Error(path);return [id,await r.text()]}));assets=Object.fromEntries(entries);state=initial();
 try{const saved=localStorage.getItem('svgdrop-project-v1');if(saved)state=validateProject(JSON.parse(saved))}catch{toast('Начинаем новый черновик: сохранённый проект недоступен.')}
 $('loading').hidden=true;$('app').hidden=false;$('prompt').value=state.title;renderExamples();render();save();
}catch(err){$('loading').hidden=true;$('load-error').hidden=false;console.error('Library load failed',err)}}
enhanceSelects();$('retry').onclick=boot;boot();
