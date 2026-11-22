import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=path.join(root,'desktop-release','FloorballEditor-win32-x64-'+stamp);
const dist=path.join(root,'node_modules/electron/dist');
await fs.mkdir(output,{recursive:true});
await fs.cp(dist,output,{recursive:true,filter:source=>path.basename(source)!=='electron.exe'});
await fs.copyFile(path.join(dist,'electron.exe'),path.join(output,'FloorballEditor.exe'));
const appDir=path.join(output,'resources/app');await fs.mkdir(appDir,{recursive:true});
for(const file of ['main.cjs','preload.cjs','runtime.cjs','github.cjs'])await fs.copyFile(path.join(root,'.desktop',file),path.join(appDir,file));
await fs.cp(path.join(root,'.desktop/assets'),path.join(appDir,'assets'),{recursive:true});
await fs.writeFile(path.join(appDir,'package.json'),JSON.stringify({name:'floorball-content-editor',productName:'地板球内容编辑器',version:'1.0.0',main:'main.cjs'}));
await fs.mkdir(path.join(output,'resources/runtime'),{recursive:true});
await fs.copyFile(process.execPath,path.join(output,'resources/runtime/node.exe'));
try{await fs.copyFile(path.join(path.dirname(process.execPath),'LICENSE'),path.join(output,'resources/runtime/NODE-LICENSE.txt'));}catch{}
const tools=path.join(root,'node_modules/.cache/floorball-media-tools');
for(const dir of ['D:/LosslessCut-win-x64/resources','D:/App-win-x64',tools]){
  try{await fs.access(path.join(dir,'ffmpeg.exe'));await fs.access(path.join(dir,'ffprobe.exe'));}catch{continue;}
  const destination=path.join(output,'resources/media-tools');await fs.mkdir(destination,{recursive:true});
  for(const name of await fs.readdir(dir))if(/^(?:ffmpeg|ffprobe)\.exe$|^(?:avcodec|avdevice|avfilter|avformat|avutil|swresample|swscale)-.*\.dll$/i.test(name))await fs.copyFile(path.join(dir,name),path.join(destination,name));
  for(const name of ['ffmpeg.exe','ffprobe.exe']){const result=spawnSync(path.join(destination,name),['-version'],{windowsHide:true,encoding:'utf8'});if(result.status!==0)throw Error(name+' cannot run in package: '+(result.stderr||result.error||result.status));}
  const license=spawnSync(path.join(destination,'ffmpeg.exe'),['-L'],{windowsHide:true,encoding:'utf8'});await fs.writeFile(path.join(destination,'FFMPEG-LICENSE.txt'),license.stdout+license.stderr);
  break;
}
await fs.writeFile(path.join(output,'使用说明.txt'),'地板球内容编辑器\r\n\r\n双击 FloorballEditor.exe；首次选择 floorball-training 项目文件夹。\r\n请保留整个程序文件夹，不能只移动 exe。\r\n使用现有项目文件与 node_modules，不需要全局 Node.js。\r\n视频工具已打包（如构建机器提供），项目文件和原始视频不会被移入程序包。\r\n文件菜单可切换项目；Ctrl+S 保存；关闭时可保存、取消或保留草稿。\r\n');
await fs.writeFile(path.join(root,'.vitepress/cache/content-editor/desktop-latest.json'),JSON.stringify({output,exe:path.join(output,'FloorballEditor.exe')},null,2));
console.log(output);
