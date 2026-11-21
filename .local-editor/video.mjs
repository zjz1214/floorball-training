import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';

export const videoExtensions = new Set(['.mp4','.webm','.mov','.m4v','.mkv','.avi']);
export function videoSignature(ext, bytes) {
  if (['.webm','.mkv'].includes(ext)) return bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]));
  if (ext === '.avi') return bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='AVI ';
  return ['ftyp','moov','mdat','wide','free'].includes(bytes.toString('ascii',4,8));
}
export function executable(name) {
  const override = process.env[name === 'ffmpeg' ? 'FLOORBALL_FFMPEG' : 'FLOORBALL_FFPROBE'];
  if (override) return override;
  for (const folder of ['D:/LosslessCut-win-x64/resources','D:/App-win-x64']) {
    const candidate = path.join(folder,name+'.exe'); if(existsSync(candidate))return candidate;
  }
  return name;
}
export function runTool(command,args,{onProgress,timeout=30*60*1000,signal}={}) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new Error('处理已取消'));return;}
    const child=spawn(command,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
    const abort=()=>{child.kill();};signal?.addEventListener('abort',abort,{once:true});
    const clean=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
    const timer=setTimeout(()=>{child.kill();reject(new Error('视频处理超时，原文件已保留，可换用较短片段重试。'));},timeout);
    child.stdout.on('data',b=>{stdout=(stdout+String(b)).slice(-4*1024*1024);onProgress?.(String(b));});
    child.stderr.on('data',b=>{stderr=(stderr+String(b)).slice(-6000);});
    child.on('error',e=>{clean();reject(new Error(e.code==='ENOENT'?'未找到视频压缩工具，请联系维护者配置 FFmpeg。':e.message));});
    child.on('exit',code=>{clean();if(signal?.aborted)reject(new Error('处理已取消'));else if(code===0)resolve(stdout);else reject(new Error('视频处理失败：'+stderr.slice(-1200)));});
  });
}
export async function probeVideo(filename) {
  const data=JSON.parse(await runTool(executable('ffprobe'),['-v','error','-show_streams','-show_format','-of','json',filename],{timeout:30000}));
  const video=data.streams?.find(s=>s.codec_type==='video'&&!s.disposition?.attached_pic);
  if(!video || !(Number(video.width)>0) || !(Number(video.height)>0))throw new Error('没有找到可播放的视频画面。');
  return { data,video,duration:Number(data.format?.duration||video.duration||0),audio:data.streams.find(s=>s.codec_type==='audio') };
}
function mp4Faststart(bytes) {
  let offset=0,moov=-1,mdat=-1;
  while(offset+8<=bytes.length){let size=bytes.readUInt32BE(offset);const tag=bytes.toString('ascii',offset+4,offset+8);if(size===1&&offset+16<=bytes.length)size=Number(bytes.readBigUInt64BE(offset+8));if(tag==='moov')moov=offset;if(tag==='mdat')mdat=offset;if(size<8)break;offset+=size;}
  return moov>=0 && mdat>=0 && moov<mdat;
}
export class VideoImports {
  constructor(root){this.root=root;this.cache=path.join(root,'.vitepress/cache/content-editor/video');this.jobs=new Map();this.queue=[];this.running=false;}
  async receive(req,ext,stem){
    const max=1024*1024*1024;
    if(Number(req.headers['content-length']||0)>max)throw Object.assign(new Error('视频超过1GB，请先截取需要的片段。'),{status:413});
    await fs.mkdir(this.cache,{recursive:true});const id=randomBytes(12).toString('hex');const source=path.join(this.cache,id+'-original'+ext);
    const file=await fs.open(source,'wx');const digest=createHash('sha256');let size=0;let header=Buffer.alloc(0);
    try{for await(const bytes of req){size+=bytes.length;if(size>max)throw Object.assign(new Error('视频超过1GB，请先截取需要的片段。'),{status:413});digest.update(bytes);if(header.length<64)header=Buffer.concat([header,bytes]).subarray(0,64);await file.writeFile(bytes);}}finally{await file.close();}
    if(!videoSignature(ext,header))throw Object.assign(new Error('文件内容与视频格式不符，未导入。'),{status:400});
    const signature=digest.digest('hex');
    // Policy suffix changes whenever encoding settings change. Originals remain in the ignored cache.
    const filename=`${stem}-${signature.slice(0,16)}-web-v1.mp4`;
    const job={id,status:'queued',progress:0,message:'等待压缩',source,signature,filename,originalBytes:size,ext};
    this.jobs.set(id,job);this.queue.push(job);this.drain();return {jobId:id,status:job.status};
  }
  status(id){const j=this.jobs.get(id);if(!j)return null;return {id:j.id,status:j.status,progress:j.progress,message:j.message,result:j.result,error:j.error};}
  async drain(){
    if(this.running)return;this.running=true;
    try{while(this.queue.length){const job=this.queue.shift();try{await this.convert(job);job.status='done';job.progress=100;job.message='视频处理完成';}catch(e){job.status='error';job.error=e.message;job.message='视频未插入，原文件已保留';}}}finally{this.running=false;}
  }
  async convert(job){
    job.status='processing';job.message='读取视频信息';job.progress=1;
    const source=await probeVideo(job.source);const destination=path.join(this.root,'public/editor-media',job.filename);
    const manifestPath=path.join(this.cache,job.signature+'-web-v1.json');
    try{const record=JSON.parse(await fs.readFile(manifestPath,'utf8'));const bytes=await fs.readFile(destination);if(record.outputHash===createHash('sha256').update(bytes).digest('hex')){job.result={...record.result,reused:true};return;}}catch{}
    const output=path.join(this.cache,job.id+'-compressed.mp4');
    const filter='scale=w=min(1920\\,iw):h=min(1920\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2';
    job.message='正在压缩视频';
    const args=['-hide_banner','-nostdin','-v','error','-i',job.source,'-map','0:v:0','-map','0:a:0?','-sn','-dn','-vf',filter,'-fps_mode','passthrough','-enc_time_base','demux','-c:v','libx264','-preset','fast','-crf','26','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-progress','pipe:1','-nostats',output];
    let progressBuffer='';
    await runTool(executable('ffmpeg'),args,{onProgress:chunk=>{progressBuffer+=chunk;const lines=progressBuffer.split('\n');progressBuffer=lines.pop();for(const line of lines){const m=line.match(/^out_time_us=(\d+)/);if(m&&source.duration>0)job.progress=Math.min(94,Math.max(job.progress,Math.round(Number(m[1])/1e6/source.duration*93)));}}});
    let chosen=output;
    // If the source is already compact and compatible, remux it rather than publish a larger re-encode.
    if((await fs.stat(output)).size>=job.originalBytes && source.video.codec_name==='h264' && source.video.pix_fmt==='yuv420p' && Math.max(source.video.width,source.video.height)<=1920 && (!source.audio||source.audio.codec_name==='aac')){
      const remux=path.join(this.cache,job.id+'-remux.mp4');
      await runTool(executable('ffmpeg'),['-hide_banner','-nostdin','-v','error','-i',job.source,'-map','0:v:0','-map','0:a:0?','-c','copy','-movflags','+faststart',remux]);
      if((await fs.stat(remux)).size<(await fs.stat(output)).size)chosen=remux;
    }
    job.status='verifying';job.progress=96;job.message='校验视频完整性';
    const verified=await probeVideo(chosen);
    if(verified.video.codec_name!=='h264'||verified.video.pix_fmt!=='yuv420p'||verified.audio&&verified.audio.codec_name!=='aac'||Math.max(verified.video.width,verified.video.height)>1920)throw new Error('输出格式校验失败，未发布此文件。');
    if(source.duration>0&&Math.abs(verified.duration-source.duration)>Math.max(.5,source.duration*.01))throw new Error('视频时长校验失败，未发布此文件。');
    await runTool(executable('ffmpeg'),['-hide_banner','-nostdin','-v','error','-xerror','-i',chosen,'-map','0:v:0','-map','0:a:0?','-f','null','-']);
    const bytes=await fs.readFile(chosen);if(!mp4Faststart(bytes))throw new Error('网页播放优化校验失败，未发布此文件。');
    await fs.mkdir(path.dirname(destination),{recursive:true});
    if(existsSync(destination)){
      const existing=await fs.readFile(destination);if(!existing.equals(bytes))throw new Error('已有同名输出与校验结果不同，已保留原文件，请联系维护者。');
    }else await fs.copyFile(chosen,destination,1);
    job.result={src:'/editor-media/'+job.filename,kind:'video',originalBytes:job.originalBytes,outputBytes:bytes.length,savedPercent:Math.max(0,Math.round((1-bytes.length/job.originalBytes)*100)),reused:false,width:verified.video.width,height:verified.video.height};
    await fs.writeFile(manifestPath,JSON.stringify({outputHash:createHash('sha256').update(bytes).digest('hex'),result:job.result}),{flag:'w'});
  }
}
