import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTactic,validateTactic,copy,uid,sampleTactic,totalDuration,viewport,exportSize,tacticSource,nextFrameObjects,resolveFrames,removeTacticObject} from '../../public/tactics-runtime/model.js';
import {renderSVG} from '../../public/tactics-runtime/render.js';
import {parseDocument,serializeDocument} from '../document.mjs';
import {TacticsStore} from '../tactics.mjs';
import {executable,runTool,probeVideo} from '../video.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root=path.join(project,'.vitepress/cache/content-editor','tactics-test-'+Date.now());
const player=()=>({id:uid(),type:'player',x:5,y:7,color:'#b45147',number:'8',label:'中锋',angle:350,width:.07,opacity:1,dashed:false});
test('court presets keep goal offsets and crease dimensions; half/portrait views keep physical coordinates',()=>{
 const doc=createTactic();let svg=renderSVG(doc);assert.match(svg,/width="40" height="20"/);assert.match(svg,/data-goal="" x="2.85"/);assert.match(svg,/data-goal="" x="36.5"/);assert.match(svg,/width="4" height="5"/);
 doc.court.size='small';svg=renderSVG(doc);assert.match(svg,/width="30" height="18"/);assert.match(svg,/data-goal="" x="2.85"/);assert.match(svg,/data-goal="" x="26.5"/);assert.match(svg,/width="4" height="5"/);
 doc.court.view='right';doc.court.orientation='portrait';assert.deepEqual(viewport(doc.court),{length:15,width:18,from:15,w:18,h:15});assert.match(renderSVG(doc),/rotate\(-90\) translate\(-15 0\)/);assert.equal(exportSize(doc).width%2,0);assert.equal(exportSize(doc).height%2,0);assert.equal(tacticSource('/tactics/../secret.json'),false);
});
test('keyframes interpolate stable identities, shortest rotation and appearance without mutating documents',()=>{
 const doc=createTactic(),a=player();doc.frames[0].objects=[a];const next=copy(doc.frames[0]);next.id=uid();next.objects[0].x=15;next.objects[0].angle=10;next.note='接球';const appearing=player();next.objects.push(appearing);doc.frames.push(next);const before=JSON.stringify(doc);const atHalf=sampleTactic(doc,1);assert.equal(atHalf.objects[0].x,10);assert.equal(atHalf.objects[0].angle,360);assert.equal(atHalf.objects[1].opacity,.5);assert.equal(sampleTactic(doc,2).note,'接球');assert.equal(sampleTactic(doc,99).objects[0].x,15);assert.equal(totalDuration(doc),4);assert.equal(JSON.stringify(doc),before);
});
test('models reject invalid geometry, oversized content and conflicting identities; SVG escapes labels',()=>{
 const doc=createTactic();doc.frames[0].objects=[player()];assert.equal(validateTactic(doc).frames[0].objects[0].number,'8');
 for(const edit of [d=>d.court.size='3v3',d=>d.frames[0].objects[0].x=NaN,d=>d.frames[0].objects[0].x=41,d=>d.frames[0].objects[0].color='url(https://example.com)',d=>d.frames[0].duration=0,d=>d.frames[0].objects.push(copy(d.frames[0].objects[0])),d=>d.frames=[],d=>d.title='x'.repeat(121)]){const invalid=copy(doc);edit(invalid);assert.throws(()=>validateTactic(invalid));}
 doc.frames[0].objects[0].label='<img onerror="bad">';assert.doesNotMatch(renderSVG(validateTactic(doc)),/<img/);assert.match(renderSVG(doc),/&lt;img/);
});
test('single-step wavy routes move their player and one existing ball along the centreline',()=>{
 const doc=createTactic(),p=player(),ball={...player(),id:uid(),type:'ball',x:5.65,y:7.15},route={...player(),id:uid(),type:'dribble',x:5,y:7,x2:15,y2:7,playerId:p.id,ballId:ball.id};doc.frames[0].objects=[p,ball,route];const valid=validateTactic(doc),before=JSON.stringify(valid);
 const atHalf=sampleTactic(valid,1).objects;assert.equal(atHalf.find(o=>o.id===p.id).x,10);assert.equal(atHalf.find(o=>o.id===p.id).y,7);assert.equal(atHalf.filter(o=>o.type==='ball').length,1);assert.equal(atHalf.find(o=>o.id===ball.id).x,10.65);assert.equal(sampleTactic(valid,2).objects.find(o=>o.id===p.id).x,15);assert.equal(JSON.stringify(valid),before);
 assert.match(renderSVG(valid),/M 5 7 L/);assert.ok((renderSVG(valid).match(/ L /g)||[]).length>50);
});
test('dashed straight and curved arrows pass one ball from beginning to end without moving players',()=>{
 const doc=createTactic(),p=player(),ball={...player(),id:uid(),type:'ball'},route={...player(),id:uid(),type:'arrow',x2:15,y2:7,dashed:true,ballId:ball.id};doc.frames[0].objects=[p,ball,route];
 let sample=sampleTactic(validateTactic(doc),1).objects;assert.equal(sample.find(o=>o.id===ball.id).x,10);assert.equal(sample.find(o=>o.id===p.id).x,5);assert.equal(sample.filter(o=>o.type==='ball').length,1);
 route.type='curve';route.cx=10;route.cy=3;sample=sampleTactic(validateTactic(doc),1).objects;assert.equal(sample.find(o=>o.id===ball.id).x,10);assert.equal(sample.find(o=>o.id===ball.id).y,5);assert.equal(sampleTactic(doc,2).objects.find(o=>o.id===ball.id).x,15);
});
test('solid arrows run a player without moving or synthesizing a ball; curved runs and legacy arrows also work',()=>{
 const doc=createTactic(),p=player(),ball={...player(),id:uid(),type:'ball',x:5.6,y:7.1},route={...player(),id:uid(),type:'arrow',x2:15,y2:7,playerId:p.id};doc.frames[0].objects=[p,ball,route];let sample=sampleTactic(validateTactic(doc),1).objects;
 assert.equal(sample.find(o=>o.id===p.id).x,10);assert.equal(sample.find(o=>o.id===ball.id).x,5.6);assert.equal(sample.filter(o=>o.type==='ball').length,1);
 doc.frames[0].objects=doc.frames[0].objects.filter(o=>o.type!=='ball');assert.equal(sampleTactic(doc,1).objects.filter(o=>o.type==='ball').length,0);
 delete route.playerId;assert.equal(sampleTactic(validateTactic(doc),1).objects.find(o=>o.id===p.id).x,10);
 route.type='curve';route.cx=10;route.cy=3;sample=sampleTactic(validateTactic(doc),1).objects;assert.equal(sample.find(o=>o.id===p.id).y,5);
 const next=nextFrameObjects(doc.frames[0],doc.court);assert.equal(next.length,1);assert.equal(next[0].x,15);assert.equal(next[0].y,7);
 route.x=25;route.y=15;assert.equal(sampleTactic(doc,1).objects.find(o=>o.id===p.id).x,5);assert.equal(nextFrameObjects(doc.frames[0],doc.court).length,2);
});
test('unplaced balls have stable identities and next steps inherit endpoints without replaying actions',()=>{
 const doc=createTactic(),p=player(),route={...player(),id:uid(),type:'dribble',x2:15,y2:7,playerId:p.id};doc.frames[0].objects=[p,route];
 const first=sampleTactic(doc,.5).objects.find(o=>o.type==='ball'),last=sampleTactic(doc,2).objects.find(o=>o.type==='ball');assert.equal(first.id,last.id);
 const next={id:uid(),duration:2,note:'',objects:nextFrameObjects(doc.frames[0],doc.court)};doc.frames.push(next);validateTactic(doc);assert.equal(next.objects.length,2);assert.equal(next.objects.find(o=>o.id===p.id).x,15);assert.equal(next.objects.find(o=>o.id===last.id).x,last.x);
 assert.equal(sampleTactic(doc,2).objects.find(o=>o.id===p.id).x,15);assert.equal(sampleTactic(doc,3).objects.find(o=>o.id===last.id).x,last.x);
 const pass=createTactic();pass.frames[0].objects=[{...route,type:'arrow',dashed:true}];const a=sampleTactic(pass,0).objects.find(o=>o.type==='ball'),b=sampleTactic(pass,2).objects.find(o=>o.type==='ball');assert.equal(a.x,5);assert.equal(b.x,15);assert.equal(a.id,b.id);
});
test('motion bindings reject missing players, missing balls and duplicate actor assignments',()=>{
 const doc=createTactic(),p=player(),route={...player(),id:uid(),type:'dribble',x2:15,y2:7,playerId:p.id};doc.frames[0].objects=[p,route];
 const missing=copy(doc);missing.frames[0].objects[1].playerId=uid();assert.throws(()=>validateTactic(missing),/关联本步球员/);
 const duplicate=copy(doc);duplicate.frames[0].objects.push({...copy(route),id:uid()});assert.throws(()=>validateTactic(duplicate),/只能有一条带球路线/);
 const run=copy(doc);run.frames[0].objects.push({...copy(route),id:uid(),type:'arrow'});assert.throws(()=>validateTactic(run),/只能有一条/);
 const ball=copy(doc);ball.frames[0].objects[1].ballId=uid();assert.throws(()=>validateTactic(ball),/球不存在/);
});
test('completed runners remain visible across pre-existing empty steps and at the animation end',()=>{
 const doc=createTactic(),p=player(),route={...player(),id:uid(),type:'arrow',playerId:p.id,x2:15,y2:7};doc.frames[0].objects=[p,route];doc.frames.push({id:uid(),duration:2,note:'后续空步骤',objects:[]},{id:uid(),duration:2,note:'结束',objects:[]});const before=JSON.stringify(doc);
 for(const t of [1.99,2,2.01,3.99,4,6,99]){const actor=sampleTactic(doc,t).objects.find(o=>o.id===p.id);assert.ok(actor,`runner missing at ${t}`);assert.equal(actor.opacity,1);if(t>=2)assert.equal(actor.x,15);}
 assert.equal(resolveFrames(doc)[2].objects.find(o=>o.id===p.id).x,15);assert.equal(JSON.stringify(doc),before);
});
test('dribbler and generated ball stay together after the action and explicit removal still removes actors',()=>{
 const doc=createTactic(),p=player(),route={...player(),id:uid(),type:'dribble',playerId:p.id,x2:15,y2:7};doc.frames[0].objects=[p,route];doc.frames.push({id:uid(),duration:2,note:'',objects:[]},{id:uid(),duration:2,note:'',objects:[]});const after=sampleTactic(doc,2).objects;assert.equal(after.find(o=>o.id===p.id).x,15);const ball=after.find(o=>o.type==='ball');assert.ok(ball);assert.equal(ball.opacity,1);assert.equal(sampleTactic(doc,6).objects.find(o=>o.id===ball.id).x,ball.x);
 doc.frames[1].removedIds=[p.id,ball.id];validateTactic(doc);assert.equal(sampleTactic(doc,2).objects.some(o=>o.id===p.id||o.id===ball.id),false);assert.equal(sampleTactic(doc,6).objects.some(o=>o.id===p.id||o.id===ball.id),false);
});
test('later explicit poses override inherited endpoints and removal markers must be consistent',()=>{
 const doc=createTactic(),p=player(),route={...player(),id:uid(),type:'arrow',playerId:p.id,x2:15,y2:7};doc.frames[0].objects=[p,route];doc.frames.push({id:uid(),duration:2,note:'',objects:[{...p,x:20}]});assert.equal(sampleTactic(doc,2).objects.find(o=>o.id===p.id).x,20);
 doc.frames[1].removedIds=[p.id];assert.throws(()=>validateTactic(doc),/同时存在和被移除/);
});
test('removing an inherited runner affects this and later steps, preserves earlier motion and does not mutate source',()=>{
 const doc=createTactic(),p=player(),route={...player(),id:uid(),type:'arrow',playerId:p.id,x2:15,y2:7};doc.frames[0].objects=[p,route];doc.frames.push({id:uid(),duration:2,note:'',objects:[]},{id:uid(),duration:2,note:'',objects:[{...p,x:15},{...route,id:uid(),x:15,x2:20}]});const before=JSON.stringify(doc);
 const removed=removeTacticObject(doc,1,p.id);validateTactic(removed);assert.equal(JSON.stringify(doc),before);assert.deepEqual(removed.frames[0],doc.frames[0]);
 const running=sampleTactic(removed,1.99).objects.find(o=>o.id===p.id);assert.ok(running);assert.equal(running.opacity,1);assert.ok(running.x>14.9);
 for(const time of [2,3,4,6])assert.equal(sampleTactic(removed,time).objects.some(o=>o.id===p.id||o.playerId===p.id),false);
 assert.ok(removed.frames[2].removedIds.includes(p.id));assert.equal(sampleTactic(doc,2).objects.some(o=>o.id===p.id),true);
});
test('tactic blocks round-trip and preserve anchors and surrounding content',()=>{
 const raw='---\npageClass: technical-reading\n---\n\n# 训练\n\n<div id="editor-block-abcdef1234"></div>\n\n<div class="floorball-tactics" data-tactics-src="/tactics/'+ 'a'.repeat(64)+'.json"></div>\n\n正文\n';const doc=parseDocument(raw);assert.equal(doc.blocks[1].type,'tactics');assert.equal(doc.blocks[1].meta.src,'/tactics/'+ 'a'.repeat(64)+'.json');assert.match(doc.blocks[1].prefix,/editor-block-abcdef1234/);assert.equal(serializeDocument(doc),raw);
});
test('immutable tactics persist and real PNG frames produce a verified deterministic MP4',async()=>{
 const store=new TacticsStore(root),doc=createTactic();doc.title='导出验证';doc.frames[0].duration=.2;doc.frames[0].objects=[player()];
 const first=await store.save(doc),again=await store.save(doc);assert.deepEqual(first,again);assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'public',first.src),'utf8')),validateTactic(doc));
 doc.title='修改后的标题';const second=await store.save(doc);assert.notEqual(first.src,second.src);assert.ok(await fs.stat(path.join(root,'public',first.src)));
 const job=await store.createExport(doc);assert.equal(job.frames,5);await assert.rejects(store.createExport(doc),{status:409});assert.throws(()=>store.finish(job.id),{status:409});
 await assert.rejects(store.frame(job.id,0,Buffer.from('bad')),{status:400});const png=path.join(root,'frame.png');
 await runTool(executable('ffmpeg'),['-hide_banner','-nostdin','-v','error','-f','lavfi','-i',`color=c=white:s=${job.width}x${job.height}`,'-frames:v','1',png]);const bytes=await fs.readFile(png);
 await assert.rejects(store.frame(job.id,1,bytes),{status:400});for(let i=0;i<job.frames;i++)await store.frame(job.id,i,bytes);store.finish(job.id);
 let status;for(let i=0;i<100;i++){status=store.status(job.id);if(['done','error'].includes(status.status))break;await new Promise(r=>setTimeout(r,100));}assert.equal(status.status,'done',status.error);const video=await probeVideo(store.download(job.id));assert.equal(Number(video.video.nb_frames),5);assert.equal(video.video.codec_name,'h264');assert.equal(video.video.pix_fmt,'yuv420p');assert.ok(Math.abs(video.duration-.2)<.05);
 const cancelled=await store.createExport(doc);store.cancel(cancelled.id);await assert.rejects(store.frame(cancelled.id,0,bytes),{status:409});assert.equal(store.status(cancelled.id).status,'cancelled');assert.throws(()=>store.download('../bad'),{status:404});
});
