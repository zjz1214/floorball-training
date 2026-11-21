import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {validateTactic,exportSize,totalDuration} from '../public/tactics-runtime/model.js';
import {renderSVG} from '../public/tactics-runtime/render.js';
import {executable,runTool,probeVideo} from './video.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const problem=(message,status=400)=>Object.assign(new Error(message),{status});
async function immutable(filename,content){try{await fs.writeFile(filename,content,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;const existing=await fs.readFile(filename);if(!existing.equals(Buffer.from(content)))throw problem('已有同名战术文件内容不同，未覆盖',409);}}
export class TacticsStore{
 constructor(root){this.root=root;this.cache=path.join(root,'.vitepress/cache/content-editor/tactics');this.jobs=new Map();}
 async save(input){const document=validateTactic(input),bytes=JSON.stringify(document,null,2)+'\n',key=digest(bytes),folder=path.join(this.root,'public/tactics');await fs.mkdir(folder,{recursive:true});await immutable(path.join(folder,key+'.json'),bytes);await immutable(path.join(folder,key+'.svg'),renderSVG(document));return {src:'/tactics/'+key+'.json',poster:'/tactics/'+key+'.svg',title:document.title};}
 async createExport(input){
  if([...this.jobs.values()].some(j=>['uploading','encoding','verifying'].includes(j.status)))throw problem('已有战术视频正在导出，请完成或取消后重试',409);
  const document=validateTactic(input),id=randomBytes(16).toString('hex'),size=exportSize(document),count=Math.ceil(totalDuration(document)*25-1e-9),dir=path.join(this.cache,id);
  await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'tactic.json'),JSON.stringify(document,null,2));
  const job={id,dir,document,...size,count,fps:25,next:0,status:'uploading',progress:0,controller:new AbortController()};this.jobs.set(id,job);return this.status(id);
 }
 job(id){const job=this.jobs.get(id);if(!job)throw problem('导出任务不存在',404);return job;}
 status(id){const j=this.job(id);return {id:j.id,status:j.status,progress:j.progress,frames:j.count,fps:j.fps,width:j.width,height:j.height,next:j.next,error:j.error,download:j.status==='done'?'/api/tactics/export-download?id='+j.id:undefined};}
 async frame(id,index,bytes){const job=this.job(id);if(job.status!=='uploading')throw problem('导出任务已结束或正在合成',409);if(!Number.isInteger(index)||index!==job.next||index>=job.count)throw problem('动画帧顺序不正确');
  if(bytes.length<33||bytes.length>8*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==job.width||bytes.readUInt32BE(20)!==job.height)throw problem('动画帧格式或尺寸不正确');
  await fs.writeFile(path.join(job.dir,String(index).padStart(5,'0')+'.png'),bytes,{flag:'wx'});job.next++;job.progress=Math.round(job.next/job.count*80);return this.status(id);
 }
 finish(id){const job=this.job(id);if(job.status!=='uploading'||job.next!==job.count)throw problem('请先完成所有动画帧',409);job.status='encoding';job.progress=82;this.encode(job).catch(error=>{if(job.status!=='cancelled'){job.status='error';job.error=error.message;}});return this.status(id);}
 cancel(id){const job=this.job(id);if(job.status!=='done'){job.status='cancelled';job.controller.abort();}return this.status(id);}
 async encode(job){
  const output=path.join(job.dir,'animation.mp4');
  await runTool(executable('ffmpeg'),['-hide_banner','-nostdin','-v','error','-framerate',String(job.fps),'-i',path.join(job.dir,'%05d.png'),'-frames:v',String(job.count),'-an','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',output],{signal:job.controller.signal});
  if(job.controller.signal.aborted)return;job.status='verifying';job.progress=95;const verified=await probeVideo(output);
  if(verified.video.codec_name!=='h264'||verified.video.pix_fmt!=='yuv420p'||verified.video.width!==job.width||verified.video.height!==job.height||Math.abs(verified.duration-job.count/job.fps)>.1||Number(verified.video.nb_frames)!==job.count)throw problem('导出视频校验失败');
  await runTool(executable('ffmpeg'),['-hide_banner','-nostdin','-v','error','-xerror','-i',output,'-f','null','-'],{signal:job.controller.signal});
  if(job.controller.signal.aborted)return;const bytes=await fs.readFile(output);if(bytes.indexOf(Buffer.from('moov'))>bytes.indexOf(Buffer.from('mdat')))throw problem('视频网页播放校验失败');job.output=output;job.status='done';job.progress=100;
 }
 download(id){const job=this.job(id);if(job.status!=='done')throw problem('视频尚未完成',409);return job.output;}
}
