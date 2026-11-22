const {app,BrowserWindow,Menu,dialog,shell,ipcMain,session,clipboard,ClipboardItem}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const {randomBytes}=require('node:crypto');
const {validateProject,isEditorURL,externalURL,freePort,readSettings,writeSettings,startService}=require('./runtime.cjs');
const github=require('./github.cjs');
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
app.setName('FloorballContentEditor');
app.setPath('userData',path.join(app.getPath('appData'),'FloorballContentEditor'));
if(arg('user-data'))app.setPath('userData',path.resolve(arg('user-data')));
const smoke=arg('smoke-test');if(smoke){app.commandLine.appendSwitch('remote-debugging-port',arg('debug-port')||'9231');require('node:inspector').open(Number(arg('main-debug-port')||9232),'127.0.0.1');}
app.setAppUserModelId('cn.floorball.content-editor');
let window,service,settings,settingsFile,project,closing=false,stopping=false,prompting=false,allowUnload=false;
let status={dirty:false,busy:false,canSave:false};const pendingSaves=new Map();
const validSender=event=>window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&service&&isEditorURL(event.senderFrame.url,service.origin);
let gitBusy=false;
ipcMain.handle('desktop:github',async(event,action,data)=>{
  if(!validSender(event))throw Error('Git 操作请求无效。');
  const root=project;
  if(action==='status')return github.status(root);
  if(action==='review')return github.review(root,data);
  if(!['commit','push'].includes(action)||gitBusy)throw Error('已有 Git 操作正在进行。');
  gitBusy=true;
  try{
    const editorReady=await window.webContents.executeJavaScript("window.dispatchEvent(new Event('floorball-desktop-status'));document.documentElement.dataset.desktopDirty==='false'&&document.documentElement.dataset.desktopBusy==='false'");
    if(!editorReady)throw Error('请保存当前页面，并等待媒体处理完成。');
    if(action==='commit')return {commit:await github.commit(root,data?.files,data?.message)};
    const plan=await github.pushPlan(root);
    if(!plan.commits)return {message:'没有待推送的提交。'};
    const detail=`目标：${plan.remote}\n分支：${plan.branch}\n\n${plan.commits}\n\n${plan.changes}`;
    if(detail.length>16000)throw Error('待推送内容超出确认窗口的显示范围，请在 Git 客户端审核并推送。');
    const {response}=await dialog.showMessageBox(window,{type:'warning',title:'确认推送到 GitHub',message:plan.branch==='main'?'推送到 main 可能触发网站部署。':'将以下本地提交推送到 GitHub。',detail,buttons:['取消','确认推送'],defaultId:0,cancelId:0,noLink:true});
    if(response!==1)return {message:'已取消推送。'};
    await github.push(root,plan);
    return {message:'已推送到 GitHub。'};
  }finally{gitBusy=false;}
});
ipcMain.on('desktop:state',(event,value)=>{if(validSender(event)&&value&&typeof value==='object')status={dirty:value.dirty===true,busy:value.busy===true,canSave:value.canSave===true};});
ipcMain.on('desktop:save-result',(event,value)=>{if(validSender(event)&&value&&pendingSaves.has(value.id)){pendingSaves.get(value.id)(value.ok===true);pendingSaves.delete(value.id);}});
ipcMain.handle('desktop:preview',async(event,name)=>{if(!validSender(event)||typeof name!=='string'||name.length>512)throw Error('预览请求无效。');await openPreview(name);});
ipcMain.handle('desktop:block-copy',async(event,value)=>{if(!validSender(event)||typeof value?.html!=='string'||typeof value?.text!=='string'||value.html.length>8*1024*1024||value.text.length>4*1024*1024||!value.html.includes('data-floorball-editor-block='))throw Error('元素复制请求无效。');await clipboard.write([new ClipboardItem({'text/html':value.html,'text/plain':value.text})]);});
ipcMain.handle('desktop:block-paste',async event=>{if(!validSender(event))throw Error('元素粘贴请求无效。');for(const item of await clipboard.read())if(item.types.includes('text/html')){const blob=await item.getType('text/html');if(blob.size>8*1024*1024)return '';const html=await blob.text();return html.includes('data-floorball-editor-block=')?html:'';}return '';});
async function savePending(){const id=randomBytes(12).toString('hex');return new Promise(resolve=>{const timer=setTimeout(()=>{pendingSaves.delete(id);resolve(false);},15000);pendingSaves.set(id,ok=>{clearTimeout(timer);resolve(ok);});window.webContents.send('desktop:save',id);});}
async function mayLeave(){
  if(gitBusy){await dialog.showMessageBox(window,{message:'Git 操作正在进行，请完成后再关闭或切换项目。'});return false;}
  if(prompting)return false;
  if(service&&!window.isDestroyed())try{status=await window.webContents.executeJavaScript("window.dispatchEvent(new Event('floorball-desktop-status'));({dirty:document.documentElement.dataset.desktopDirty==='true',busy:document.documentElement.dataset.desktopBusy==='true',canSave:document.documentElement.dataset.desktopCanSave==='true'})");}catch{}
  if(status.busy){await dialog.showMessageBox(window,{type:'info',title:'请等待处理完成',message:'正在保存、导入或导出，请完成后再关闭或切换项目。',buttons:['继续编辑']});return false;}
  if(!status.dirty)return true;prompting=true;
  try{const canSave=status.canSave;const {response}=await dialog.showMessageBox(window,{type:'question',title:'有未保存内容',message:canSave?'当前页面尚未保存。':'战术板还有未应用的修改，请先在战术板中保存。',detail:canSave?'页面草稿会保留在这台电脑；文件不会被自动覆盖。':'尚未应用的战术板修改不会写入页面。',buttons:canSave?['保存后继续','取消','保留草稿并离开']:['继续编辑','放弃战术板修改并离开'],defaultId:0,cancelId:canSave?1:0,noLink:true});if(canSave&&response===0)return savePending();return response===(canSave?2:1);}finally{prompting=false;}
}
async function shutdown(){if(stopping)return;stopping=true;await service?.stop();app.exit(0);}
function defaultProject(){return app.isPackaged?path.resolve(path.dirname(process.execPath),'../..'):path.resolve(__dirname,'..');}
async function pickProject(){const answer=await dialog.showOpenDialog(window,{title:'选择地板球训练项目文件夹',defaultPath:project||settings.project||defaultProject(),properties:['openDirectory'],buttonLabel:'打开项目'});return answer.canceled?null:validateProject(answer.filePaths[0]);}
async function launchProject(root){
  const key=process.platform==='win32'?root.toLowerCase():root;settings.projects||={};const previous=settings.projects[key]||{};
  const port=await freePort(previous.port||5180);let previewPort=await freePort(previous.previewPort||port+1);if(previewPort===port)previewPort=await freePort(port+1);
  const node=app.isPackaged?path.join(process.resourcesPath,'runtime/node.exe'):process.env.FLOORBALL_NODE||'D:/nodejs/node.exe';
  const logDir=path.join(app.getPath('userData'),'logs');await fs.mkdir(logDir,{recursive:true});
  const tools=path.join(process.resourcesPath,'media-tools');let mediaTools;try{await fs.access(path.join(tools,'ffmpeg.exe'));mediaTools={ffmpeg:path.join(tools,'ffmpeg.exe'),ffprobe:path.join(tools,'ffprobe.exe')};}catch{}
  service=await startService({root,node,port,previewPort,logFile:path.join(logDir,'service-'+Date.now()+'.log'),mediaTools});
  project=root;status={dirty:false,busy:false,canSave:false};settings.project=root;settings.projects[key]={port,previewPort};await writeSettings(settingsFile,settings);window.setTitle('地板球内容编辑器 · '+path.basename(root));allowUnload=true;await window.loadURL(service.origin);
}
async function switchProject(){if(!await mayLeave())return;const next=await pickProject();if(!next||next===project)return;await service.stop();service=null;await launchProject(next);}
async function openPreview(name){name||=await window.webContents.executeJavaScript("document.querySelector('.tree-page.current')?.dataset.path || 'index.md'");const info=await fetch(service.origin+'/api/session').then(r=>r.json());const response=await fetch(service.origin+'/api/preview',{method:'POST',headers:{'Content-Type':'application/json','Origin':service.origin,'X-Editor-Session':info.token},body:JSON.stringify({path:name})});const value=await response.json();if(!response.ok)throw Error(value.error);const u=new URL(value.url);if(u.hostname==='127.0.0.1'&&u.port===String(service.previewPort))await shell.openExternal(u.href);}
async function showError(error){await dialog.showMessageBox(window,{type:'error',title:'操作未完成',message:error.message||String(error),buttons:['知道了']});}
function menu(){Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'文件',submenu:[{label:'打开项目…',accelerator:'CmdOrCtrl+O',click:()=>switchProject().catch(showError)},{label:'保存页面',accelerator:'CmdOrCtrl+S',click:()=>savePending()},{type:'separator'},{label:'打开项目文件夹',click:()=>shell.openPath(project)},{label:'退出',accelerator:'Alt+F4',click:()=>window.close()}]},
  {label:'编辑',submenu:[{label:'撤销',accelerator:'CmdOrCtrl+Z',click:()=>editorKey('z')},{label:'重做',accelerator:'CmdOrCtrl+Shift+Z',click:()=>editorKey('z',true)},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},
  {label:'视图',submenu:[{label:'网页预览',click:()=>openPreview().catch(showError)},{label:'刷新编辑器',accelerator:'CmdOrCtrl+R',click:async()=>{if(await mayLeave()){allowUnload=true;window.webContents.reload();}}},{role:'resetZoom',label:'实际大小'},{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{role:'togglefullscreen',label:'全屏'}]},
  {label:'帮助',submenu:[{label:'诊断日志',click:()=>shell.openPath(path.join(app.getPath('userData'),'logs'))},{label:'关于',click:()=>dialog.showMessageBox(window,{title:'地板球内容编辑器',message:'地板球内容编辑器',detail:'本地可视化编辑、媒体压缩与战术板。\n项目：'+project})}]}
]));}
function editorKey(key,shift=false){return window.webContents.executeJavaScript(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},ctrlKey:true,shiftKey:${shift},bubbles:true}))`);}
if(!app.requestSingleInstanceLock())app.exit(0);
else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.on('window-all-closed',()=>shutdown());app.on('before-quit',event=>{if(!stopping){event.preventDefault();window?.close();}});
 app.whenReady().then(async()=>{
  settingsFile=path.join(app.getPath('userData'),'settings.json');settings=await readSettings(settingsFile);session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  window=new BrowserWindow({width:settings.bounds?.width||1480,height:settings.bounds?.height||960,minWidth:1000,minHeight:680,show:false,backgroundColor:'#f7f9f8',icon:path.join(__dirname,'assets/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webviewTag:false,spellcheck:false}});
  window.on('close',event=>{if(closing)return;event.preventDefault();mayLeave().then(async allowed=>{if(!allowed)return;settings.bounds=window.getNormalBounds();await writeSettings(settingsFile,settings);closing=true;window.destroy();}).catch(showError);});
  window.webContents.setWindowOpenHandler(({url})=>{const target=externalURL(url);if(target&&(!service||!isEditorURL(target,service.origin)))shell.openExternal(target);return {action:'deny'};});
  window.webContents.on('will-navigate',(event,url)=>{if(!service||!isEditorURL(url,service.origin)){event.preventDefault();const target=externalURL(url);if(target)shell.openExternal(target);}});
  window.webContents.on('will-prevent-unload',event=>{if(allowUnload)event.preventDefault();});window.webContents.on('did-finish-load',()=>{allowUnload=false;});window.show();
  try{const candidate=arg('project')||settings.project;let root;if(candidate){try{root=await validateProject(candidate);}catch(error){await showError(error);}}root||=await pickProject();if(!root){closing=true;window.destroy();return;}await launchProject(root);menu();if(smoke)await fs.writeFile(path.resolve(smoke),JSON.stringify({pid:process.pid,servicePid:service.child.pid,origin:service.origin,project,packaged:app.isPackaged},null,2));}
  catch(error){await showError(error);closing=true;window.destroy();}
 }).catch(error=>{dialog.showErrorBox('桌面编辑器启动失败',error.message);shutdown();});
}
