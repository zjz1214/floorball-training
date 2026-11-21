import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { VideoImports, probeVideo, runTool } from '../video.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root=path.join(project,'.vitepress/cache/content-editor','video-test-'+Date.now());
const ffmpeg=process.env.FLOORBALL_FFMPEG||'D:/LosslessCut-win-x64/resources/ffmpeg.exe';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const rate=ratio=>{const [a,b]=ratio.split('/').map(Number);return a/b;};
async function frames(filename){const text=await runTool(ffmpeg.replace(/ffmpeg(\.exe)?$/i,'ffprobe$1'),['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','json',filename]);return Number(JSON.parse(text).streams[0].nb_read_frames);}
async function wait(imports,id){for(let i=0;i<1200;i++){const s=imports.status(id);if(s.status==='error')throw new Error(s.error);if(s.status==='done')return s.result;await new Promise(r=>setTimeout(r,100));}throw new Error('Video job timed out');}
async function receive(imports,filename,ext,stem){const req=createReadStream(filename);req.headers={'content-length':String((await fs.stat(filename)).size)};return imports.receive(req,ext,stem);}
test('actual clip compresses, preserves source/frame rate, verifies web format and reuses output', {timeout:180000}, async()=>{
  const source=path.join(project,'public/floorball-3v3-goalkeeper-throw-in.mp4');const before=digest(await fs.readFile(source));
  await fs.mkdir(root,{recursive:true});const imports=new VideoImports(root);const src=await probeVideo(source);
  const job=await receive(imports,source,'.mp4','守门员示范');const result=await wait(imports,job.jobId);
  const output=path.join(root,'public',result.src);const out=await probeVideo(output);
  assert.equal(out.video.codec_name,'h264');assert.equal(out.video.pix_fmt,'yuv420p');if(src.audio)assert.equal(out.audio.codec_name,'aac');
  assert.ok(Math.max(out.video.width,out.video.height)<=1920);assert.ok(Math.abs(rate(out.video.avg_frame_rate)-rate(src.video.avg_frame_rate))<.01);assert.equal(await frames(source),await frames(output));
  assert.ok(result.outputBytes<result.originalBytes,JSON.stringify(result));assert.equal(digest(await fs.readFile(source)),before);
  const backup=imports.jobs.get(job.jobId).source;assert.equal(digest(await fs.readFile(backup)),before);
  const second=await receive(imports,source,'.mp4','守门员示范');const repeated=await wait(imports,second.jobId);assert.equal(repeated.reused,true);assert.equal(repeated.src,result.src);
  console.log(`Actual clip: ${result.originalBytes} -> ${result.outputBytes} bytes (${result.savedPercent}% smaller); original ${src.video.avg_frame_rate} fps retained.`);
});
test('MKV with VP9/Opus becomes playable H.264/AAC without upscaling', {timeout:90000},async()=>{
  await fs.mkdir(root,{recursive:true});const source=path.join(root,'vp9-opus.mkv');
  await runTool(ffmpeg,['-hide_banner','-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1','-c:v','libvpx-vp9','-b:v','350k','-c:a','libopus',source]);
  const imports=new VideoImports(root);const job=await receive(imports,source,'.mkv','混合编码');const result=await wait(imports,job.jobId);const out=await probeVideo(path.join(root,'public',result.src));
  assert.equal(out.video.codec_name,'h264');assert.equal(out.audio.codec_name,'aac');assert.equal(out.video.width,320);assert.equal(out.video.height,240);assert.ok(Math.abs(rate(out.video.avg_frame_rate)-24)<.05);assert.equal(await frames(source),await frames(path.join(root,'public',result.src)));
});
test('invalid video never reaches public media and retains diagnostic input',async()=>{
  const isolated=path.join(root,'invalid');const imports=new VideoImports(isolated);const req=Readable.from([Buffer.from('0000ftyp0000invalid')]);req.headers={};const job=await imports.receive(req,'.mp4','invalid');
  for(let i=0;i<100;i++){if(imports.status(job.jobId).status==='error')break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(imports.status(job.jobId).status,'error');assert.ok((await fs.stat(imports.jobs.get(job.jobId).source)).size>0);
  await assert.rejects(fs.readdir(path.join(isolated,'public/editor-media')),/ENOENT/);
});
test('large frame sizes shrink proportionally and remain within the 1920px edge limit',{timeout:90000},async()=>{
  await fs.mkdir(root,{recursive:true});const source=path.join(root,'large.mkv');
  await runTool(ffmpeg,['-hide_banner','-nostdin','-v','error','-f','lavfi','-i','color=c=blue:size=2560x1440:rate=30','-t','0.2','-c:v','libx264','-preset','ultrafast','-crf','16',source]);
  const imports=new VideoImports(root);const job=await receive(imports,source,'.mkv','大画幅');const result=await wait(imports,job.jobId);const out=await probeVideo(path.join(root,'public',result.src));
  assert.equal(out.video.width,1920);assert.equal(out.video.height,1080);assert.equal(await frames(source),await frames(path.join(root,'public',result.src)));
});
