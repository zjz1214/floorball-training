const fs=require('node:fs/promises'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
async function validateProject(candidate){
  if(typeof candidate!=='string'||!path.isAbsolute(candidate))throw Error('请选择完整的项目文件夹。');
  const root=await fs.realpath(candidate);
  for(const file of ['package.json','.vitepress/config.ts','.local-editor/server.mjs','.local-editor/document.mjs','node_modules/vitepress/package.json','node_modules/markdown-it/package.json']){
    try{if(!(await fs.stat(path.join(root,file))).isFile())throw Error();}catch{throw Error('项目文件或依赖不完整：'+file);}
  }return root;
}
function isEditorURL(value,origin){try{const u=new URL(value);return u.origin===origin&&!u.username&&!u.password;}catch{return false;}}
function externalURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
async function freePort(preferred=5180){
  for(let port=preferred;port<preferred+100;port++){const probe=net.createServer();const available=await new Promise(resolve=>{probe.once('error',()=>resolve(false));probe.listen(port,'127.0.0.1',()=>probe.close(()=>resolve(true)));});if(available)return port;}
  throw Error('本地端口被占用，请关闭其他编辑器后重试。');
}
async function readSettings(filename){try{return JSON.parse(await fs.readFile(filename,'utf8'));}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;return {projects:{}};}}
async function writeSettings(filename,settings){await fs.mkdir(path.dirname(filename),{recursive:true});const temp=filename+'.'+process.pid+'.tmp';await fs.writeFile(temp,JSON.stringify(settings,null,2)+'\n');await fs.rename(temp,filename);}
async function startService({root,node,port,previewPort,logFile,mediaTools}){
  const origin='http://127.0.0.1:'+port;
  const child=spawn(node,[path.join(root,'.local-editor/server.mjs')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,FLOORBALL_EDITOR_ROOT:root,FLOORBALL_EDITOR_PORT:String(port),FLOORBALL_PREVIEW_PORT:String(previewPort),FLOORBALL_EDITOR_DESKTOP:'1',...(mediaTools?.ffmpeg?{FLOORBALL_FFMPEG:mediaTools.ffmpeg,FLOORBALL_FFPROBE:mediaTools.ffprobe}:{})}});
  let failure='',exited=false;const writes=[];
  const log=data=>{if(logFile)writes.push(fs.appendFile(logFile,data).catch(()=>{}));};
  child.stdout.on('data',log);child.stderr.on('data',data=>{failure=(failure+String(data)).slice(-2000);log(data);});child.on('error',error=>{failure=error.message;exited=true;});child.on('exit',()=>{exited=true;});
  async function stop(){if(!exited){const done=new Promise(resolve=>child.once('exit',resolve));if(child.connected)child.send({type:'floorball-desktop-shutdown'},()=>{});else child.kill();const timer=setTimeout(()=>child.kill(),4000);await done;clearTimeout(timer);}await Promise.all(writes);}
  try{for(let i=0;i<150;i++){if(exited)throw Error(failure||'本地编辑服务意外退出。');try{const response=await fetch(origin+'/api/session',{signal:AbortSignal.timeout(500)});if(response.ok){const session=await response.json();if(session.root!==root)throw Error('端口已被其他项目占用。');return {child,origin,root,previewPort,stop};}}catch(error){if(error.message==='端口已被其他项目占用。')throw error;}await new Promise(resolve=>setTimeout(resolve,100));}throw Error('编辑服务启动超时。'+failure);}catch(error){await stop();throw error;}
}
module.exports={validateProject,isEditorURL,externalURL,freePort,readSettings,writeSettings,startService};
