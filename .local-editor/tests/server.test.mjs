import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {createTactic} from '../../public/tactics-runtime/model.js';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(project, '.vitepress/cache/content-editor', `test-${Date.now()}`);
let processHandle, origin, token; let errors='';
const original='---\npageClass: technical-reading\n---\n\n# 测试页面\n\n原有正文\n\n<video src="/old.mp4" style="max-width:50%" controls></video>\n';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=', 'base64');
before(async () => {
  const probe = net.createServer(); await new Promise(r=>probe.listen(0,'127.0.0.1',r)); const port=probe.address().port; await new Promise(r=>probe.close(r)); origin=`http://127.0.0.1:${port}`;
  await fs.mkdir(path.join(root,'个人技术基础'),{recursive:true}); await fs.mkdir(path.join(root,'.local-editor'),{recursive:true});
  await fs.mkdir(path.join(root,'public'),{recursive:true}); await fs.writeFile(path.join(root,'.local-editor/pages.json'),'[]\n');
  await fs.writeFile(path.join(root,'个人技术基础/测试.md'),original); await fs.writeFile(path.join(root,'index.md'),'# 首页\n');
  processHandle=spawn(process.execPath,[path.join(project,'.local-editor/server.mjs')],{env:{...process.env,FLOORBALL_EDITOR_ROOT:root,FLOORBALL_EDITOR_PORT:String(port)},windowsHide:true});
  processHandle.stderr.on('data',x=>errors+=x);
  for(let i=0;i<70;i++){try{const r=await fetch(origin+'/api/session');if(r.ok){token=(await r.json()).token;return;}}catch{}await new Promise(r=>setTimeout(r,80));}
  throw new Error('Test server did not start: '+errors);
});
after(async()=>{processHandle?.kill();});
async function post(endpoint,data,headers={}){return fetch(origin+endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Session':token,Origin:origin,...headers},body:JSON.stringify(data)});}
async function page(){const r=await fetch(origin+'/api/page?path='+encodeURIComponent('个人技术基础/测试.md'));return r.json();}
test('saves only requested edits and backs up previous file; stale writes are rejected',async()=>{
  const d=await page();const p=d.blocks.find(b=>b.type==='text');p.raw='更新后的正文\n';
  const r=await post('/api/save',{path:d.path,version:d.version,document:d});assert.equal(r.status,200);
  const saved=await r.json();assert.equal(await fs.readFile(path.join(root,d.path),'utf8'),original.replace('原有正文','更新后的正文'));
  const backups=await fs.readdir(path.join(root,'.vitepress/cache/content-editor/backups'));assert.equal(backups.length,1);assert.equal(await fs.readFile(path.join(root,'.vitepress/cache/content-editor/backups',backups[0]),'utf8'),original);
  assert.equal((await post('/api/save',{path:d.path,version:d.version,document:d})).status,409);
  const doc=await page();await fs.appendFile(path.join(root,d.path),'\n外部编辑\n');assert.equal((await post('/api/save',{path:d.path,version:doc.version,document:doc})).status,409);
  assert.ok(saved.saved);
});
test('creates a Chinese-named page once and registers its sidebar entry',async()=>{
  const r=await post('/api/create',{category:'个人技术基础',title:'新练习'});assert.equal(r.status,200);const p=await r.json();assert.equal(p.profile,'technical-reading');
  const registry=JSON.parse(await fs.readFile(path.join(root,'.local-editor/pages.json'),'utf8'));assert.equal(registry[0].path,'个人技术基础/新练习.md');
  assert.equal((await post('/api/create',{category:'个人技术基础',title:'新练习'})).status,409);
  assert.equal((await post('/api/create',{category:'个人技术基础',title:'../秘密'})).status,400);
});
test('old draft models are reparsed without writing files or losing table breaks',async()=>{
 const document={frontmatter:'',blocks:[{type:'raw',prefix:'',raw:'| A | B |\n| --- | --- |\n| 1 | first<br>second |\n'}],tail:''};
 const before=await fs.readFile(path.join(root,'个人技术基础/测试.md'),'utf8');const r=await post('/api/reparse',{path:'个人技术基础/测试.md',document});assert.equal(r.status,200);const parsed=await r.json();assert.equal(parsed.blocks[0].type,'table');assert.match(parsed.blocks[0].raw,/<br>/);assert.equal(await fs.readFile(path.join(root,'个人技术基础/测试.md'),'utf8'),before);
});
test('page ordering persists without touching content and rejects stale or invalid moves',async()=>{
 const before=await fs.readFile(path.join(root,'个人技术基础/测试.md'),'utf8');const initial=await(await fetch(origin+'/api/tree')).json();const group=initial.groups.find(g=>g.category==='个人技术基础');const paths=group.pages.map(p=>p.path).reverse();
 let r=await post('/api/order',{category:group.category,paths,version:initial.orderVersion});assert.equal(r.status,200);const ordered=await r.json();assert.deepEqual(ordered.groups.find(g=>g.category===group.category).pages.map(p=>p.path),paths);
 const reopened=await(await fetch(origin+'/api/tree')).json();assert.deepEqual(reopened.groups.find(g=>g.category===group.category).pages.map(p=>p.path),paths);assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'.local-editor/order.json'),'utf8'))[group.category],paths);
 assert.equal(await fs.readFile(path.join(root,'个人技术基础/测试.md'),'utf8'),before);
 r=await post('/api/order',{category:group.category,paths,version:initial.orderVersion});assert.equal(r.status,409);
 for(const invalid of [[paths[0],paths[0]],paths.slice(1),['其他/秘密.md',...paths.slice(1)]]){r=await post('/api/order',{category:group.category,paths:invalid,version:reopened.orderVersion});assert.equal(r.status,400);}
});
test('directory renaming persists display names while preserving content, paths and ordering',async()=>{
 const initial=await(await fetch(origin+'/api/tree')).json();const before=await fs.readFile(path.join(root,'个人技术基础/测试.md'),'utf8');
 const ordered=initial.groups.find(g=>g.category==='个人技术基础').pages.map(p=>p.path);
 let r=await post('/api/rename',{kind:'page',key:'个人技术基础/测试.md',name:'新目录显示名',version:initial.namesVersion});assert.equal(r.status,200);let state=await r.json();
 assert.equal(state.groups.find(g=>g.category==='个人技术基础').pages.find(p=>p.path==='个人技术基础/测试.md').title,'新目录显示名');
 assert.deepEqual(state.groups.find(g=>g.category==='个人技术基础').pages.map(p=>p.path),ordered);assert.equal(await fs.readFile(path.join(root,'个人技术基础/测试.md'),'utf8'),before);
 r=await post('/api/rename',{kind:'category',key:'个人技术基础',name:'基础课程',version:state.namesVersion});assert.equal(r.status,200);state=await r.json();assert.equal(state.groups.find(g=>g.category==='个人技术基础').displayName,'基础课程');
 const reopened=await(await fetch(origin+'/api/tree')).json();assert.equal(reopened.groups.find(g=>g.category==='个人技术基础').displayName,'基础课程');
 r=await post('/api/rename',{kind:'page',key:'个人技术基础/测试.md',name:'冲突',version:initial.namesVersion});assert.equal(r.status,409);
 for(const name of ['', '<script>', 'bad\nname'])assert.equal((await post('/api/rename',{kind:'page',key:'个人技术基础/测试.md',name,version:state.namesVersion})).status,400);
 r=await post('/api/rename',{kind:'page',key:'个人技术基础/新练习.md',name:'新目录显示名',version:state.namesVersion});assert.equal(r.status,400);
});
test('groups create, rename, move, reorder and persist without touching page files',async()=>{
 let state=await(await fetch(origin+'/api/tree')).json();const before=await fs.readFile(path.join(root,'个人技术基础/测试.md'),'utf8');const originalVersion=state.groupsVersion;
 const change=async data=>{const r=await post('/api/groups',{category:'个人技术基础',version:state.groupsVersion,...data});assert.equal(r.status,200,await r.clone().text());state=await r.json();return state.groups.find(g=>g.category==='个人技术基础');};
 let group=await change({action:'create',name:'秋季训练'});const first=group.folders[0].id;
 assert.deepEqual(group.folders[0].pages,[]);
 assert.equal((await post('/api/groups',{category:'个人技术基础',version:originalVersion,action:'create',name:'旧版本'})).status,409);
 for(const data of [{action:'create',name:'秋季训练',id:first},{action:'create',name:'<bad>'},{action:'move',path:'其他/不存在.md',id:first},{action:'move',path:'个人技术基础/测试.md',id:'missing'},{action:'order',ids:[first,first]}])assert.equal((await post('/api/groups',{category:'个人技术基础',version:state.groupsVersion,...data})).status,400);
 group=await change({action:'create',name:'春季训练'});const second=group.folders[1].id;
 await change({action:'move',path:'个人技术基础/测试.md',id:first});group=await change({action:'move',path:'个人技术基础/测试.md',id:second});
 assert.equal(group.children.filter(n=>n.type==='page').some(n=>n.page.path==='个人技术基础/测试.md'),false);assert.deepEqual(group.folders.find(f=>f.id===first).pages,[]);assert.equal(group.children.find(n=>n.id===second).pages[0].title,'新目录显示名');
 group=await change({action:'rename',id:second,name:'春季基础'});group=await change({action:'order',ids:[second,first]});assert.equal(group.folders[0].name,'春季基础');
 const stale=state.groupsVersion;
 let r=await post('/api/create',{category:'个人技术基础',title:'分组新页面',group:second,groupsVersion:state.groupsVersion});assert.equal(r.status,200);state=await(await fetch(origin+'/api/tree')).json();group=state.groups.find(g=>g.category==='个人技术基础');assert.ok(group.folders[0].pages.includes('个人技术基础/分组新页面.md'));
 assert.equal((await post('/api/create',{category:'个人技术基础',title:'过期分组页面',group:second,groupsVersion:stale})).status,409);
 assert.equal((await post('/api/create',{category:'个人技术基础',title:'无效分组页面',group:'missing',groupsVersion:state.groupsVersion})).status,400);
 await assert.rejects(fs.stat(path.join(root,'个人技术基础/过期分组页面.md')),{code:'ENOENT'});
 group=await change({action:'move',path:'个人技术基础/测试.md',id:''});assert.ok(group.children.some(n=>n.type==='page'&&n.page.path==='个人技术基础/测试.md'));
 assert.equal(await fs.readFile(path.join(root,'个人技术基础/测试.md'),'utf8'),before);
 const persisted=JSON.parse(await fs.readFile(path.join(root,'.local-editor/groups.json'),'utf8'));assert.equal(persisted['个人技术基础'][0].id,second);assert.deepEqual(persisted['个人技术基础'][0].pages,['个人技术基础/分组新页面.md']);
 assert.ok((await fs.readdir(path.join(root,'.vitepress/cache/content-editor/backups'))).some(name=>name.endsWith('groups.json')));
});
test('tactics endpoints enforce session, validate models, preserve assets and restrict export jobs',async()=>{
 const document=createTactic();document.title='边路配合';document.court.size='small';document.frames[0].duration=.2;
 assert.equal((await post('/api/tactics/save',{document},{'X-Editor-Session':''})).status,403);
 let r=await post('/api/tactics/save',{document});assert.equal(r.status,200);const saved=await r.json();assert.match(saved.src,/^\/tactics\/[a-f0-9]{64}\.json$/);assert.equal((await fetch(origin+'/media'+saved.src)).status,200);
 assert.equal(JSON.parse(await fs.readFile(path.join(root,'public',saved.src),'utf8')).court.size,'small');
 const reference=`# 战术链接\n\n<div class="floorball-tactics" data-tactics-src="${saved.src}"></div>\n`;await fs.writeFile(path.join(root,'个人技术基础/战术链接.md'),reference);const targets=await(await fetch(origin+'/api/targets?path='+encodeURIComponent('个人技术基础/战术链接.md'))).json();assert.ok(targets.targets.some(t=>t.type==='block'&&t.label==='战术板 · 边路配合'));
 r=await post('/api/tactics/save',{document});assert.equal((await r.json()).src,saved.src);
 const bad=structuredClone(document);bad.court.size='../secret';assert.equal((await post('/api/tactics/save',{document:bad})).status,400);
 r=await post('/api/tactics/export-create',{document});assert.equal(r.status,200);const job=await r.json();assert.equal(job.frames,5);
 assert.equal((await fetch(origin+'/api/tactics/export-download?id='+job.id)).status,409);
 assert.equal((await fetch(origin+'/api/tactics/export-download?id=../secret')).status,404);
 const frame=await fetch(origin+'/api/tactics/export-frame?id='+job.id+'&index=0',{method:'POST',headers:{'X-Editor-Session':token,Origin:origin},body:png});assert.equal(frame.status,400);
 assert.equal((await post('/api/tactics/export-finish',{id:job.id})).status,409);
 assert.equal((await post('/api/tactics/export-cancel',{id:job.id})).status,200);assert.equal((await(await fetch(origin+'/api/tactics/export-status?id='+job.id)).json()).status,'cancelled');
});
test('media import deduplicates without overwrites, and range requests work',async()=>{
  assert.equal((await fetch(origin+'/media/nonexistent.mp4')).status,404);
  assert.equal((await fetch(origin+'/api/session')).status,200);
  async function upload(){const r=await fetch(origin+'/api/import?name='+encodeURIComponent('训练图片.png'),{method:'POST',headers:{'X-Editor-Session':token,Origin:origin},body:png});assert.equal(r.status,200);return r.json();}
  const a=await upload(),b=await upload();assert.equal(a.src,b.src);assert.deepEqual(await fs.readFile(path.join(root,'public',a.src)),png);
  const range=await fetch(origin+'/media'+a.src,{headers:{Range:'bytes=0-7'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,8);
  const bad=await fetch(origin+'/api/import?name=bad.mp4',{method:'POST',headers:{'X-Editor-Session':token,Origin:origin},body:'<script>bad</script>'});assert.equal(bad.status,400);
});
test('cross-origin writes, missing session and content/config path escapes are denied',async()=>{
  const d=await page();
  for(const headers of [{'X-Editor-Session':''},{Origin:'https://example.com'}])assert.equal((await post('/api/save',{path:d.path,version:d.version,document:d},headers)).status,403);
  for(const name of ['../.env','.vitepress/config.ts','个人技术基础/../../.env','个人技术基础\\测试.md','AGENTS.md'])assert.equal((await fetch(origin+'/api/page?path='+encodeURIComponent(name))).status,400);
});
test('junctions and symbolic links cannot escape the content root',async t=>{
  const outside=path.join(root,'outside');await fs.mkdir(outside);await fs.writeFile(path.join(outside,'test.md'),'not a site page');
  try{await fs.symlink(outside,path.join(root,'装备器材'),process.platform==='win32'?'junction':'dir');}catch(e){if(['EPERM','EACCES'].includes(e.code)){t.skip('Host does not permit creating test links');return;}throw e;}
  assert.equal((await fetch(origin+'/api/page?path='+encodeURIComponent('装备器材/test.md'))).status,400);
});
test('link targets use actual duplicate/custom anchors and persist stable block anchors safely',async()=>{
 const name='个人技术基础/定位.md';const source='# 定位\n\n## 重复\n\n需要定位的正文\n\n## 重复\n\n### 自定义 {#custom}\n';await fs.writeFile(path.join(root,name),source);
 const response=await fetch(origin+'/api/targets?path='+encodeURIComponent(name));assert.equal(response.status,200);const {targets}=await response.json();
 const duplicate=targets.filter(t=>t.label==='重复');assert.equal(duplicate.length,2);assert.notEqual(duplicate[0].id,duplicate[1].id);assert.ok(targets.some(t=>t.id==='custom'));
 const block=targets.find(t=>t.type==='block'&&t.label.includes('需要定位'));assert.ok(block);
 let r=await post('/api/ensure-anchor',{path:name,version:block.version,blockIndex:block.blockIndex,id:block.id});assert.equal(r.status,200);
 const modified=await fs.readFile(path.join(root,name),'utf8');assert.ok(modified.includes(`<div id="${block.id}"></div>`));assert.equal(modified.replace(`<div id="${block.id}"></div>\n\n`,''),source);
 const current=await(await fetch(origin+'/api/targets?path='+encodeURIComponent(name))).json();const existing=current.targets.find(t=>t.type==='block'&&t.label.includes('需要定位'));assert.equal(existing.id,block.id);assert.equal(existing.existing,true);
 r=await post('/api/ensure-anchor',{path:name,version:existing.version,blockIndex:existing.blockIndex,id:'editor-block-fake'});assert.equal(r.status,400);
 await fs.appendFile(path.join(root,name),'\n外部修改\n');r=await post('/api/ensure-anchor',{path:name,version:existing.version,blockIndex:existing.blockIndex,id:existing.id});assert.equal(r.status,409);
});
