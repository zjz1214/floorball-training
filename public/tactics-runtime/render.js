import {COURTS,viewport,sampleTactic,runnerFor,resolveFrames} from './model.js';
export const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=value=>Number(Number(value).toFixed(4));
export function wavyPath(o){const dx=o.x2-o.x,dy=o.y2-o.y,length=Math.hypot(dx,dy);if(length<.01)return `M ${n(o.x)} ${n(o.y)} L ${n(o.x2)} ${n(o.y2)}`;const count=Math.max(12,Math.ceil(length/.08)),cycles=Math.max(1,Math.round(length/.7));let path='';for(let i=0;i<=count;i++){const t=i/count,offset=Math.sin(t*cycles*2*Math.PI)*.13*Math.min(1,t*length/.3,(1-t)*length/.3);path+=(i?' L ':'M ')+n(o.x+dx*t-dy/length*offset)+' '+n(o.y+dy*t+dx/length*offset);}return path;}
function field(court){
 const {length:l,width:w}=COURTS[court.size],y=w/2;let marks='';
 if(court.markings){marks+=`<path d="M ${l/2} 0 V ${w}"/><circle cx="${l/2}" cy="${y}" r=".13" fill="#648773"/>`;for(const x of [3.5,l/2,l-3.5])for(const yy of [1.5,w-1.5])marks+=`<path d="M ${x-.28} ${yy} H ${x+.28} M ${x} ${yy-.28} V ${yy+.28}"/>`;for(const x of [2.85,l-6.85])marks+=`<rect x="${x}" y="${y-2.5}" width="4" height="5"/>`;for(const x of [3.5,l-4.5])marks+=`<rect x="${x}" y="${y-1.25}" width="1" height="2.5"/>`;}
 let goals='';for(const x of [2.85,l-3.5])goals+=`<rect data-goal="" x="${x}" y="${y-.8}" width=".65" height="1.6" rx=".04" fill="#a4554820" stroke="#a45548" stroke-width=".09"/>`;
 return `<rect x="0" y="0" width="${l}" height="${w}" rx="2" fill="${court.color}" stroke="#648773" stroke-width=".09"/><g fill="none" stroke="#8fa797" stroke-width=".045">${marks}</g>${goals}`;
}
function objectSVG(o,prefix,selected){
 const c=escapeText(o.color),x=n(o.x),y=n(o.y),sw=n(o.width??.07),dash=o.dashed?' stroke-dasharray=".27 .2"':'';let body='',transform='';
 if(['line','arrow','curve','dribble'].includes(o.type)){
  const d=o.type==='dribble'?wavyPath(o):o.type==='curve'?`M ${x} ${y} Q ${n(o.cx)} ${n(o.cy)} ${n(o.x2)} ${n(o.y2)}`:`M ${x} ${y} L ${n(o.x2)} ${n(o.y2)}`;
  body=`<path d="${d}" fill="none" stroke="transparent" stroke-width=".7"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"${dash}${o.type!=='line'?` marker-end="url(#${prefix}-${o.id})"`:''}/>`;
  if(o.type!=='line')body=`<defs><marker id="${prefix}-${o.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${c}"/></marker></defs>`+body;
 }else{
  transform=` transform="translate(${x} ${y}) rotate(${n(o.angle||0)})"`;
  if(o.type==='player'||o.type==='goalkeeper'){body=o.type==='player'?`<circle r=".52" fill="${c}" stroke="#ffffff" stroke-width=".07"/>`:`<rect x="-.54" y="-.54" width="1.08" height="1.08" rx=".2" fill="${c}" stroke="#fff" stroke-width=".07"/>`;body+=`<path d="M .4 -.28 L .78 -.28 L .78 .25" fill="none" stroke="${c}" stroke-width=".08" stroke-linecap="round"/><text transform="rotate(${n(-o.angle||0)})" text-anchor="middle" dominant-baseline="central" fill="white" font-size=".47" font-weight="700">${escapeText(o.number)}</text>`;if(o.label)body+=`<text transform="rotate(${n(-o.angle||0)})" text-anchor="middle" y=".96" fill="#273e32" font-size=".38" paint-order="stroke" stroke="#ffffff" stroke-width=".09">${escapeText(o.label)}</text>`;}
  else if(o.type==='ball')body=`<circle r=".19" fill="white" stroke="#4d6759" stroke-width=".045"/><circle r=".04" fill="#7d9183"/><circle cx=".08" cy="-.06" r=".03" fill="#7d9183"/>`;
  else if(o.type==='cone')body=`<path d="M 0 -.4 L .36 .32 Q 0 .48 -.36 .32 Z" fill="${c}" stroke="#ffffff" stroke-width=".055"/>`;
  else if(o.type==='text')body=`<text text-anchor="middle" dominant-baseline="central" fill="${c}" font-size=".58" font-weight="600">${escapeText(o.label||'说明')}</text>`;
  else if(o.type==='area')body=`<rect x="${-o.w/2}" y="${-o.h/2}" width="${n(o.w)}" height="${n(o.h)}" rx=".1" fill="${c}" fill-opacity=".14" stroke="${c}" stroke-width="${sw}"${dash}/>`;
  else if(o.type==='freehand'){transform='';const points=o.points.map(p=>p.map(n).join(',')).join(' ');body=`<polyline points="${points}" fill="none" stroke="transparent" stroke-width=".7"/><polyline points="${points}" fill="none" stroke="${c}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${sw}"${dash}/>`;}
 }
 const outline=selected?`<circle cx="${x}" cy="${y}" r=".78" fill="none" stroke="#087f6a" stroke-width=".045" stroke-dasharray=".13 .1" pointer-events="none"/>`:'';let handles='';
 if(selected&&['line','arrow','curve','dribble'].includes(o.type))for(const [handle,hx,hy] of [['start',o.x,o.y],['end',o.x2,o.y2],...(o.type==='curve'?[['control',o.cx,o.cy]]:[])])handles+=`<circle data-handle="${handle}" data-object-id="${o.id}" cx="${n(hx)}" cy="${n(hy)}" r=".22" fill="white" stroke="#087f6a" stroke-width=".06"/>`;
 return `<g data-object-id="${o.id}" opacity="${n(o.opacity??1)}"${transform}>${body}</g>${outline}${handles}`;
}
export function renderSVG(doc,{time,frame=0,selected='',prefix='tactics',background=true}={}){
 const v=viewport(doc.court),portrait=doc.court.orientation==='portrait',resolved=time===undefined?resolveFrames(doc)[frame]:null,sample=resolved?{objects:resolved.objects,source:resolved.objects,index:frame}:sampleTactic(doc,time),source=sample.source,objects=sample.objects.map(o=>{const owner=runnerFor(o,source);return owner?{...o,x:owner.x,y:owner.y}:o;});
 const layer=o=>o.id===selected?10:o.type==='area'?0:['line','arrow','curve','dribble','freehand'].includes(o.type)?1:2;objects.sort((a,b)=>layer(a)-layer(b));
 const transform=portrait?`translate(1 ${v.length+1}) rotate(-90) translate(${-v.from} 0)`:`translate(${1-v.from} 1)`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v.w+2} ${v.h+2}" role="img" aria-label="${escapeText(doc.title||'地板球战术板')}" style="display:block;width:100%;height:auto;overflow:hidden;font-family:Arial,'Microsoft YaHei',sans-serif"><defs><clipPath id="${prefix}-clip"><rect width="${v.w}" height="${v.h}" x="1" y="1"/></clipPath></defs>${background?'<rect width="100%" height="100%" rx=".4" fill="#f0f4ef"/>':''}<g clip-path="url(#${prefix}-clip)"><g data-world="" transform="${transform}">${field(doc.court)}${objects.map(o=>objectSVG(o,prefix,o.id===selected)).join('')}</g></g></svg>`;
}
export async function drawCanvas(canvas,svg){const sized=svg.replace('<svg ',`<svg width="${canvas.width}" height="${canvas.height}" `),blob=new Blob([sized],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),image=new Image();try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('画面生成失败'));image.src=url;});const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);}finally{URL.revokeObjectURL(url);}}
