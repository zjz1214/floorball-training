import {validateTactic,totalDuration,sampleTactic,frameTime,tacticSource,uid} from './model.js';
import {renderSVG} from './render.js';
const mounted=new WeakMap();
export function mountTactics(root=document,{assetBase=''}={}){
 const nodes=[...(root.matches?.('.floorball-tactics[data-tactics-src]')?[root]:[]),...root.querySelectorAll('.floorball-tactics[data-tactics-src]')];
 for(const host of nodes){const src=host.getAttribute('data-tactics-src');if(mounted.get(host)?.src===src)continue;mounted.get(host)?.dispose();const abort=new AbortController();let raf=0,doc,time=0,playing=false,last=0,disposed=false;const prefix=uid();
  const controller={src,pause:()=>{playing=false;cancelAnimationFrame(raf);paint();},dispose:()=>{disposed=true;abort.abort();cancelAnimationFrame(raf);}};mounted.set(host,controller);
  host.innerHTML='<p class="tp-message">正在读取战术…</p>';
  function paint(){if(!doc||disposed)return;const sample=sampleTactic(doc,time);host.querySelector('.tp-board').innerHTML=renderSVG(doc,{time,prefix});host.querySelector('.tp-play').textContent=playing?'暂停':'播放';host.querySelector('.tp-progress').value=time;host.querySelector('.tp-time').textContent=`${time.toFixed(1)} / ${totalDuration(doc).toFixed(1)} s`;host.querySelector('.tp-note').textContent=sample.note;host.querySelectorAll('.tp-step').forEach((b,i)=>b.classList.toggle('active',sample.index===i));}
  function tick(now){if(!playing||disposed)return;if(!host.isConnected){controller.dispose();return;}time+=Math.min(.2,(now-last)/1000)*Number(host.querySelector('.tp-speed').value);last=now;const duration=totalDuration(doc);if(time>=duration){if(host.querySelector('.tp-loop').checked)time%=duration;else{time=duration;playing=false;}}paint();if(playing)raf=requestAnimationFrame(tick);}
  async function load(){try{
   if(!tacticSource(src))throw new Error('战术地址不正确');const response=await fetch(assetBase.replace(/\/$/,'')+src,{signal:abort.signal});if(!response.ok)throw new Error('无法读取战术');doc=validateTactic(await response.json());if(disposed)return;
   host.innerHTML='<figure class="tp-figure"><figcaption class="tp-title"></figcaption><p class="tp-description"></p><div class="tp-board"></div><div class="tp-controls"><button type="button" class="tp-play">播放</button><button type="button" class="tp-reset">复位</button><input type="range" class="tp-progress" min="0" step="0.01" aria-label="动画进度"><span class="tp-time"></span><select class="tp-speed" aria-label="播放速度"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select><label class="tp-loop-label"><input type="checkbox" class="tp-loop">循环</label></div><div class="tp-steps"></div><p class="tp-note" aria-live="polite"></p></figure>';
   const title=host.querySelector('.tp-title');title.textContent=doc.title;title.hidden=!doc.title;const description=host.querySelector('.tp-description');description.textContent=doc.description;description.hidden=!doc.description;
   host.querySelector('.tp-progress').max=totalDuration(doc);
   host.querySelector('.tp-play').onclick=()=>{playing=!playing;if(playing){if(time>=totalDuration(doc))time=0;last=performance.now();raf=requestAnimationFrame(tick);}else cancelAnimationFrame(raf);paint();};
   host.querySelector('.tp-reset').onclick=()=>{time=0;controller.pause();};host.querySelector('.tp-progress').oninput=e=>{time=Number(e.target.value);controller.pause();};
   doc.frames.forEach((frame,i)=>{const b=document.createElement('button');b.type='button';b.className='tp-step';b.textContent=`${i+1}`;b.title=frame.note||`步骤 ${i+1}`;b.onclick=()=>{time=frameTime(doc,i);controller.pause();};host.querySelector('.tp-steps').append(b);});paint();host.dataset.tacticsReady='true';
  }catch(e){if(!disposed){host.textContent=e.message;host.classList.add('tp-error');}}}load();
 }
}
export function observeTactics(root=document,options={}){let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;mountTactics(root,options);});});mountTactics(root,options);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-tactics-src']});return ()=>{observer.disconnect();for(const node of root.querySelectorAll('.floorball-tactics'))mounted.get(node)?.dispose();};}
