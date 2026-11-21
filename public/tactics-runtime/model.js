export const COURTS={standard:{length:40,width:20,label:'标准场 · 40 × 20 m'},small:{length:30,width:18,label:'小场 · 30 × 18 m'}};
export const TYPES=['player','goalkeeper','ball','cone','text','line','arrow','curve','dribble','area','freehand'];
export const uid=()=>'t'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)).replace(/-/g,'');
export const copy=value=>JSON.parse(JSON.stringify(value));
export function createTactic(){return {version:1,title:'',description:'',court:{size:'standard',view:'full',orientation:'landscape',color:'#f5f8f2',markings:true},frames:[{id:uid(),duration:2,note:'',objects:[]}]};}
function fail(message){throw Object.assign(new Error('战术数据不正确：'+message),{status:400});}
function number(value,min,max,name){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail(name);return value;}
function text(value,max,name){if(typeof value!=='string'||value.length>max)fail(name);return value;}
function color(value){if(typeof value!=='string'||!/^#[a-f0-9]{6}$/i.test(value))fail('颜色');return value;}
const id=value=>{if(typeof value!=='string'||!/^t[a-zA-Z0-9]{1,60}$/.test(value))fail('标识');return value;};
export function validateTactic(input){
 if(!input||input.version!==1||!input.court)fail('版本');const c=input.court;
 if(!Object.hasOwn(COURTS,c.size)||!['full','left','right'].includes(c.view)||!['landscape','portrait'].includes(c.orientation)||typeof c.markings!=='boolean')fail('场地');
 const court={size:c.size,view:c.view,orientation:c.orientation,color:color(c.color),markings:c.markings},dims=COURTS[c.size];
 if(!Array.isArray(input.frames)||input.frames.length<1||input.frames.length>100)fail('步骤数应为1至100');const frameIds=new Set(),types=new Map();
 const frames=input.frames.map(frame=>{
  if(!frame||frameIds.has(frame.id))fail('步骤标识重复');frameIds.add(frame.id);
  if(!Array.isArray(frame.objects)||frame.objects.length>150)fail('单步最多150个元素');const objectIds=new Set();
  const objects=frame.objects.map(o=>{
   if(!o||!TYPES.includes(o.type)||objectIds.has(o.id))fail('元素类型或重复标识');objectIds.add(o.id);
   if(types.has(o.id)&&types.get(o.id)!==o.type)fail('同一元素不能改变类型');types.set(o.id,o.type);
   const result={id:id(o.id),type:o.type,x:number(o.x,0,dims.length,'横坐标'),y:number(o.y,0,dims.width,'纵坐标'),angle:number(o.angle??0,-3600,3600,'旋转'),color:color(o.color),label:text(o.label??'',120,'标签'),number:text(o.number??'',8,'号码'),width:number(o.width??.07,.02,.5,'线宽'),opacity:number(o.opacity??1,0,1,'透明度'),dashed:!!o.dashed};
   if(['line','arrow','curve','dribble'].includes(o.type)){result.x2=number(o.x2,0,dims.length,'终点');result.y2=number(o.y2,0,dims.width,'终点');}
   if(o.type==='dribble'||o.playerId!==undefined&&isRun(o))result.playerId=id(o.playerId);
   if(o.ballId!==undefined)result.ballId=id(o.ballId);
   if(o.type==='curve'){result.cx=number(o.cx,0,dims.length,'控制点');result.cy=number(o.cy,0,dims.width,'控制点');}
   if(o.type==='area'){result.w=number(o.w,.1,dims.length,'区域宽度');result.h=number(o.h,.1,dims.width,'区域高度');}
   if(o.type==='freehand'){if(!Array.isArray(o.points)||o.points.length<1||o.points.length>256)fail('自由笔点数');result.points=o.points.map(p=>{if(!Array.isArray(p)||p.length!==2)fail('自由笔坐标');return [number(p[0],0,dims.length,'自由笔坐标'),number(p[1],0,dims.width,'自由笔坐标')];});}
   return result;
  });
  const owners=new Set(),balls=new Set();
  for(const o of objects){if(o.playerId){if(!objects.some(p=>p.id===o.playerId&&p.type==='player'))fail('动作路线需要关联本步球员');if(owners.has(o.playerId))fail('同一球员每步只能有一条带球路线或无球跑路线');owners.add(o.playerId);}if(o.ballId!==undefined){if(!isMotion(o)||isRun(o)||!objects.some(p=>p.id===o.ballId&&p.type==='ball'))fail('路线关联的球不存在或路线不带球');if(balls.has(o.ballId))fail('同一个球每步只能有一条运动路线');balls.add(o.ballId);}}
  const removed=frame.removedIds??[];if(!Array.isArray(removed)||removed.length>150||new Set(removed).size!==removed.length)fail('移除标记');for(const value of removed){id(value);if(objects.some(o=>o.id===value))fail('同一元素不能同时存在和被移除');}
  return {id:id(frame.id),duration:number(frame.duration,.2,20,'步骤时长应为0.2至20秒'),note:text(frame.note??'',600,'步骤说明'),objects,...(removed.length?{removedIds:[...removed]}:{})};
 });
 if(frames.reduce((sum,f)=>sum+f.duration,0)>180)fail('总时长最多180秒');
 return {version:1,title:text(input.title??'',120,'标题'),description:text(input.description??'',1500,'说明'),court,frames};
}
export const totalDuration=doc=>doc.frames.reduce((sum,f)=>sum+f.duration,0);
export const frameTime=(doc,index)=>doc.frames.slice(0,index).reduce((sum,f)=>sum+f.duration,0);
export function resolveFrames(doc){
 const carried=new Map(),resolved=[];
 for(const original of doc.frames){
  const removed=new Set(original.removedIds||[]);for(const id of removed)carried.delete(id);
  const objects=[...original.objects],present=new Set(objects.map(o=>o.id));for(const [id,actor] of carried)if(!present.has(id)&&!removed.has(id))objects.push({...actor});
  const frame={...original,objects},end=applyMotion(frame,1,objects,doc.court),endById=new Map(end.map(o=>[o.id,o]));
  for(const id of carried.keys())if(endById.has(id))carried.set(id,endById.get(id));
  for(const path of objects.filter(isMotion)){const owner=runnerFor(path,objects);if(owner&&endById.has(owner.id))carried.set(owner.id,endById.get(owner.id));}
  if(objects.some(o=>o.type==='dribble'||['arrow','curve'].includes(o.type)&&o.dashed))for(const ball of end.filter(o=>o.type==='ball')){const previous=objects.find(o=>o.id===ball.id);if(!previous||previous.x!==ball.x||previous.y!==ball.y||objects.some(o=>o.ballId===ball.id))carried.set(ball.id,ball);}
  resolved.push(frame);
 }
 return resolved;
}
export function removeTacticObject(doc,index,objectId){
 const resolved=resolveFrames(doc),selected=resolved[index]?.objects.find(o=>o.id===objectId);if(!selected)return doc;
 const result=copy(doc),actor=['player','goalkeeper','ball'].includes(selected.type),last=actor?result.frames.length:index+1;
 for(let i=index;i<last;i++){
  const frame=result.frames[i];
  if(actor)frame.removedIds=[...new Set([...(frame.removedIds||[]),objectId])];
  frame.objects=frame.objects.filter(o=>o.id!==objectId&&o.playerId!==objectId&&(!actor||runnerFor(o,resolved[i].objects)?.id!==objectId));
  for(const o of frame.objects)if(o.ballId===objectId)delete o.ballId;
 }
 return result;
}
export function sampleTactic(doc,time){
 const frames=resolveFrames(doc);
 let i=0,t=Math.max(0,time);while(i<frames.length-1&&t>=frames[i].duration){t-=frames[i].duration;i++;}
 const frame=frames[i],next=frames[i+1];if(!next)return {objects:applyMotion(frame,Math.min(1,t/frame.duration),frame.objects,doc.court),index:i,note:frame.note,source:frame.objects};
 const progress=Math.min(1,t/frame.duration),b=new Map(next.objects.map(o=>[o.id,o])),aIds=new Set(frame.objects.map(o=>o.id));
 const objects=frame.objects.map(a=>{const target=b.get(a.id);if(!target)return {...a,opacity:next.removedIds?.includes(a.id)?(a.opacity??1):(a.opacity??1)*(1-progress)};const result={...a};for(const key of ['x','y','x2','y2','cx','cy','w','h','width','opacity'])if(typeof a[key]==='number'&&typeof target[key]==='number')result[key]=a[key]+(target[key]-a[key])*progress;const turn=(((target.angle-a.angle)%360)+540)%360-180;result.angle=a.angle+turn*progress;if(a.points&&target.points&&a.points.length===target.points.length)result.points=a.points.map((p,j)=>p.map((v,k)=>v+(target.points[j][k]-v)*progress));return result;});
 for(const target of next.objects)if(!aIds.has(target.id))objects.push({...target,opacity:(target.opacity??1)*progress});return {objects:applyMotion(frame,progress,objects,doc.court),index:i,note:frame.note,source:frame.objects};
}
export const isRun=o=>['arrow','curve'].includes(o.type)&&!o.dashed;
export const isMotion=o=>o.type==='dribble'||['arrow','curve'].includes(o.type);
export function runnerFor(path,objects){if(path.type!=='dribble'&&!isRun(path))return null;if(path.playerId)return objects.find(o=>o.id===path.playerId&&o.type==='player');return objects.filter(o=>o.type==='player'&&Math.hypot(o.x-path.x,o.y-path.y)<=1.2).sort((a,b)=>Math.hypot(a.x-path.x,a.y-path.y)-Math.hypot(b.x-path.x,b.y-path.y))[0];}
export function pathPosition(path,t,objects=[]){
 const owner=runnerFor(path,objects),x=owner?.x??path.x,y=owner?.y??path.y;
 if(path.type==='curve'){const u=1-t;return {x:u*u*x+2*u*t*path.cx+t*t*path.x2,y:u*u*y+2*u*t*path.cy+t*t*path.y2,dx:2*((1-t)*(path.cx-x)+t*(path.x2-path.cx)),dy:2*((1-t)*(path.cy-y)+t*(path.y2-path.cy))};}
 return {x:x+(path.x2-x)*t,y:y+(path.y2-y)*t,dx:path.x2-x,dy:path.y2-y};
}
export function nearestBall(objects,x,y,excluded=new Set()){return objects.filter(o=>o.type==='ball'&&!excluded.has(o.id)&&Math.hypot(o.x-x,o.y-y)<=1.2).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];}
function virtualBallId(id){let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;return 'tball'+id.slice(1,45)+hash.toString(16);}
function applyMotion(frame,progress,base,court){
 const routes=frame.objects.filter(isMotion);if(!routes.length)return base;
 const result=new Map(base.map(o=>[o.id,{...o}])),usedBalls=new Set(routes.filter(o=>o.ballId).map(o=>o.ballId)),usedRunners=new Set(routes.filter(o=>o.playerId).map(o=>o.playerId)),dims=COURTS[court.size];
 for(const path of routes){
  const start=pathPosition(path,0,frame.objects),p=pathPosition(path,progress,frame.objects),owner=runnerFor(path,frame.objects);
  if((path.type==='dribble'||isRun(path))&&(!owner||!path.playerId&&usedRunners.has(owner.id)))continue;
  if(owner)usedRunners.add(owner.id);
  let x=p.x,y=p.y;
  if(owner){const previous=result.get(owner.id)||owner;const length=Math.hypot(p.dx,p.dy)||1,ux=p.dx/length,uy=p.dy/length;result.set(owner.id,{...previous,x:p.x,y:p.y,angle:Math.atan2(p.dy,p.dx)*180/Math.PI});x+=ux*.65-uy*.15;y+=uy*.65+ux*.15;}
  if(isRun(path))continue;
  const ball=path.ballId?frame.objects.find(o=>o.id===path.ballId&&o.type==='ball'):nearestBall(frame.objects,start.x,start.y,usedBalls);if(ball)usedBalls.add(ball.id);
  const moving=ball||{id:virtualBallId(path.id),type:'ball',color:'#ffffff',angle:0,label:'',number:'',width:.07,opacity:1,dashed:false};
  result.set(moving.id,{...moving,x:Math.max(0,Math.min(dims.length,x)),y:Math.max(0,Math.min(dims.width,y))});
 }
 return [...result.values()];
}
export function nextFrameObjects(frame,court){return copy(applyMotion(frame,1,frame.objects,court).filter(o=>!isMotion(o)||isRun(o)&&!runnerFor(o,frame.objects)));}
export function viewport(court){const d=COURTS[court.size],length=court.view==='full'?d.length:d.length/2;return {length,width:d.width,from:court.view==='right'?d.length/2:0,w:court.orientation==='portrait'?d.width:length,h:court.orientation==='portrait'?length:d.width};}
export function exportSize(doc){const v=viewport(doc.court),scale=1280/Math.max(v.w+2,v.h+2);return {width:Math.round((v.w+2)*scale/2)*2,height:Math.round((v.h+2)*scale/2)*2};}
export const tacticSource=src=>typeof src==='string'&&/^\/tactics\/[a-f0-9]{64}\.json$/.test(src);
