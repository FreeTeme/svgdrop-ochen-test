from pathlib import Path
import xml.etree.ElementTree as E
from svgpathtools import parse_path
import copy,json,hashlib,re
ROOT=Path(__file__).resolve().parent.parent
BASE=ROOT/'dist/assets'; BASE.mkdir(parents=True,exist_ok=True)
E.register_namespace('', 'http://www.w3.org/2000/svg'); ns='{http://www.w3.org/2000/svg}'
names={'book':'Книга','phone':'Телефон','puzzle':'Пазлы','coin':'Монета','headphones':'Наушники','lamp':'Лампа','folder':'Папка','pen':'Ручка','wallet':'Кошелёк','flowers':'Цветы'}
indices={'L':{'book':[12,10],'phone':[14],'puzzle':[5],'coin':[26],'headphones':[16],'lamp':[18],'folder':[24],'pen':[22],'wallet':[20],'flowers':[36]},'S':{'book':[10],'phone':[11],'puzzle':[12],'coin':[13],'headphones':[14],'lamp':[15],'folder':[16],'pen':[17],'wallet':[18],'flowers':[2]}}
mono={'L':{'book':[13,11],'phone':[15],'puzzle':[6],'coin':[27],'headphones':[17],'lamp':[19],'folder':[25],'pen':[23],'wallet':[21],'flowers':[37]},'S':{'book':[19],'phone':[20],'puzzle':[21],'coin':[22],'headphones':[23],'lamp':[24],'folder':[25],'pen':[26],'wallet':[27],'flowers':[3]}}
manifest=[]
def bounds(elements):
 bs=[]
 for el in elements:
  for n in el.iter():
   if n.tag==ns+'path' and n.get('d'): bs.append(parse_path(n.get('d')).bbox())
 return min(b[0] for b in bs),max(b[1] for b in bs),min(b[2] for b in bs),max(b[3] for b in bs)
for size in ['L','S']:
 src=ROOT/'assets-source'/('library-'+size+'.svg'); r=E.parse(src).getroot(); children=list(r[0])
 for variant, mapping in [('main',indices[size]),('mono',mono[size])]:
  for key,ids in mapping.items():
   els=[copy.deepcopy(children[i]) for i in ids]; x,x2,y,y2=bounds(els); w=x2-x;h=y2-y
   root=E.Element(ns+'svg',{'viewBox':f'0 0 {w:.4f} {h:.4f}','width':f'{w:.4f}','height':f'{h:.4f}','fill':'none'})
   g=E.SubElement(root,ns+'g',{'transform':f'translate({-x:.6f} {-y:.6f})'});g.extend(els)
   for n in root.iter():
    if 'id' in n.attrib: del n.attrib['id']
   file=f'{key}-{variant}-{size}.svg';E.ElementTree(root).write(BASE/file,encoding='unicode')
   manifest.append({'id':f'{key}-{variant}-{size}','key':key,'name':names[key],'variant':variant,'size':size,'file':file,'width':round(w,4),'height':round(h,4),'paths':sum(1 for n in root.iter() if n.tag==ns+'path')})
 for pi,idx in enumerate(([2,4,3] if size=='L' else [4,6,5])):
  el=copy.deepcopy(children[idx]); rect=next((n for n in el.iter() if n.tag==ns+'rect'),None)
  if rect is not None:
   tr=re.findall(r'[-\d.]+',rect.get('transform',''));x,y=map(float,tr[:2]);w=float(rect.get('width'));h=float(rect.get('height'))
  else:x,x2,y,y2=bounds([el]);w=x2-x;h=y2-y
  root=E.Element(ns+'svg',{'viewBox':f'{x} {y} {w} {h}','width':str(w),'height':str(h),'fill':'none'});root.append(el)
  defs=next((n for n in r if n.tag==ns+'defs'),None)
  if defs is not None:root.append(copy.deepcopy(defs))
  E.ElementTree(root).write(BASE/f'background-{pi}-{size}.svg',encoding='unicode')
(BASE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Extracted',len(manifest),'objects and 6 backgrounds')
