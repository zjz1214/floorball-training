import http from 'node:http';
import { promises as fs, existsSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { categories, hash, parseDocument, serializeDocument, pageClass, splitFrontmatter, renderPreview, validateDocument, escapeHTML, md } from './document.mjs';
import { VideoImports, videoExtensions } from './video.mjs';
import { sortByOrder } from './order.mjs';
import { pageTitle } from './names.mjs';
import { groupPages } from './groups.mjs';
import { TacticsStore } from './tactics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.FLOORBALL_EDITOR_ROOT ? path.resolve(process.env.FLOORBALL_EDITOR_ROOT) : path.resolve(here, '..');
const cache = path.join(root, '.vitepress/cache/content-editor');
const token = randomBytes(32).toString('hex');
const port = Number(process.env.FLOORBALL_EDITOR_PORT || 5174);
const origin = `http://127.0.0.1:${port}`;
const previewPort=Number(process.env.FLOORBALL_PREVIEW_PORT||5173);
const previewOrigin=`http://127.0.0.1:${previewPort}`;
const registry = path.join(root, '.local-editor/pages.json');
const orderFile=path.join(root,'.local-editor/order.json');
const namesFile=path.join(root,'.local-editor/names.json');
const groupsFile=path.join(root,'.local-editor/groups.json');
const videoImports = new VideoImports(root);
const tactics = new TacticsStore(root);
let previewProcess; let previewStatus = ''; let saving = false;
let rendererPromise;
async function siteRender(markdown, name = 'index.md') {
  rendererPromise ||= (async () => {
    const { createMarkdownRenderer, resolveConfig } = await import('vitepress');
    const config = await resolveConfig(root, 'serve');
    return createMarkdownRenderer(root, config.markdown, config.site.base);
  })();
  const renderer = await rendererPromise;
  return renderer.render(markdown, { path: path.join(root, name), relativePath: name });
}
async function linkTargets(name,source){
  const html=await siteRender(splitFrontmatter(source).body,name);
  const route='/'+(name==='index.md'?'':name.replace(/index\.md$/,'').replace(/\.md$/,'').split('/').map(encodeURIComponent).join('/'));
  const targets=[{id:'',label:'整篇页面',level:0,url:route}];
  for(const match of html.matchAll(/<h([1-6])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)){
    const id=md.utils.unescapeAll(match[2]);
    const label=md.utils.unescapeAll(match[3].replace(/<a\b[^>]*class="header-anchor"[^>]*>[\s\S]*?<\/a>/g,'').replace(/<[^>]+>/g,'')).trim();
    targets.push({id,label,level:Number(match[1]),url:route+'#'+encodeURIComponent(id)});
  }
  const doc=parseDocument(source);let section='';
  let headingCursor=0;
  for(const target of targets.filter(t=>t.level)){
    const index=doc.blocks.findIndex((b,i)=>i>=headingCursor&&b.type==='heading'&&b.meta.level===target.level&&md.utils.unescapeAll(b.html.replace(/<[^>]*>/g,'')).replace(/\s*\{#[^}]+\}/,'').trim()===target.label);
    if(index>=0){target.blockIndex=index;headingCursor=index+1;}
  }
  const labels={text:'正文',list:'列表',table:'表格',callout:'提示框',quote:'引用',image:'图片',video:'视频',gallery:'并排媒体',tactics:'战术板',raw:'内容'};
  const tacticTitles=new Map();
  for(const [index,b] of doc.blocks.entries())if(b.type==='tactics'){try{const data=JSON.parse(await fs.readFile(await safePath('public'+b.meta.src,['public']),'utf8'));if(typeof data.title==='string')tacticTitles.set(index,data.title.slice(0,120));}catch{}}
  doc.blocks.forEach((b,index)=>{
    if(b.type==='heading'){section=b.raw.replace(/^#+\s*/,'').replace(/\s*\{#[^}]*\}/,'').trim();return;}
    if(b.type==='divider'||/^\s*<div id="editor-block-[a-f0-9]+"><\/div>\s*$/.test(b.raw))return;
    const visible=md.utils.unescapeAll((b.html||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
    if(b.type==='raw'&&!visible)return;
    const marker=blockAnchor(doc,index);const id=marker||'editor-block-'+hash(name+'\0'+index+'\0'+b.raw).slice(0,16);
    const summary=b.type==='tactics'?(tacticTitles.get(index)||'地板球战术'):b.title||visible.slice(0,48)||b.raw.match(/src=["']([^"']+)["']/)?.[1]?.split('/').at(-1)?.slice(0,40)||'未填写内容';
    targets.push({id,label:(labels[b.type]||'内容')+' · '+summary,section,level:3,type:'block',blockIndex:index,existing:!!marker,version:hash(source),previewHTML:b.html||'',url:route+'#'+id});
  });
  return {path:name,targets};
}
function blockAnchor(doc,index){
  const prefix=doc.blocks[index]?.prefix||'';const previous=doc.blocks[index-1];
  return prefix.match(/<div id="(editor-block-[a-f0-9]+)"><\/div>\s*$/)?.[1]||previous?.raw.match(/^\s*<div id="(editor-block-[a-f0-9]+)"><\/div>\s*$/)?.[1]||'';
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
const uploads = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', ...videoExtensions]);
class Problem extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

// Reject reparse points/symlinks at every existing path component, including assets.
export async function safePath(relative, bases = categories) {
  if (typeof relative !== 'string' || relative.includes('\\') || /[\x00-\x1f:]/.test(relative)) throw new Problem('文件路径不正确');
  const parts = relative.split('/');
  if (parts.some(p => !p || p === '.' || p === '..') || !bases.includes(parts[0])) throw new Problem('只能操作当前网站允许的内容目录');
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Problem('不支持通过目录链接访问文件'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return current;
}
async function pagePath(name) {
  if (name === 'index.md') return safePath(name, ['index.md']);
  if (!name?.endsWith('.md') || name.split('/').length !== 2 || path.posix.basename(name).startsWith('.')) throw new Problem('请选择网站内容页面');
  return safePath(name);
}
async function readRegistry() { try { return JSON.parse(await fs.readFile(registry, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return []; throw e; } }
async function readOrder(){let raw;try{raw=await fs.readFile(orderFile,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;raw='{}\n';}return {data:JSON.parse(raw),version:hash(raw)};}
async function readNames(){let raw;try{raw=await fs.readFile(namesFile,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;raw='{"pages":{},"categories":{}}\n';}const data=JSON.parse(raw);return {data:{pages:data.pages||{},categories:data.categories||{}},version:hash(raw)};}
async function readGroups(){let raw;try{raw=await fs.readFile(groupsFile,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;raw='{}\n';}return {data:JSON.parse(raw),version:hash(raw)};}
async function directoryData(){const order=await readOrder();const names=await readNames();const folders=await readGroups();const groups=await tree(order.data,names.data);for(const group of groups){group.folders=folders.data[group.category]||[];group.children=groupPages(group.pages,group.folders);}return {groups,orderVersion:order.version,namesVersion:names.version,groupsVersion:folders.version,homeName:pageTitle(await fs.readFile(path.join(root,'index.md'),'utf8'),names.data.pages['index.md']||'网站首页')};}
function directoryName(value){const name=String(value||'').trim();if(!name||name.length>80||/[<>\x00-\x1f]/.test(name))throw new Problem('名称不能为空，最多80字，不能包含换行或尖括号。');return name;}
const normalizedName=value=>value.normalize('NFKC').toLocaleLowerCase('zh-CN');
async function atomicWrite(filename, content, backup = true) {
  if (backup && existsSync(filename)) {
    await fs.mkdir(path.join(cache, 'backups'), { recursive: true });
    const label = path.relative(root, filename).replace(/[\\/:]/g, '_');
    await fs.copyFile(filename, path.join(cache, 'backups', `${Date.now()}-${randomBytes(3).toString('hex')}-${label}`));
  }
  const temp = `${filename}.editor-${randomBytes(5).toString('hex')}.tmp`;
  await fs.writeFile(temp, content, { flag: 'wx' });
  await fs.rename(temp, filename);
}
async function tree(order,names) {
  order??=(await readOrder()).data;
  names??=(await readNames()).data;
  const groups = [];
  for (const category of categories) {
    const dir = await safePath(category); let entries;
    try { entries = await fs.readdir(dir); } catch { continue; }
    const pages = [];
    for (const name of entries.filter(n => n.endsWith('.md') && !n.startsWith('.'))) {
      const filename = await pagePath(`${category}/${name}`);
      if (!(await fs.lstat(filename)).isFile()) continue;
      const source = await fs.readFile(filename, 'utf8');
      const pageName=`${category}/${name}`,sourceTitle=pageTitle(source,names.pages[pageName]||name.slice(0,-3));
      pages.push({ path: pageName, title:sourceTitle,sourceTitle });
    }
    pages.sort((a, b) => (a.path.endsWith('/index.md') ? -1 : b.path.endsWith('/index.md') ? 1 : a.sourceTitle.localeCompare(b.sourceTitle, 'zh-CN')));
    const overview=pages.find(page=>page.path===category+'/index.md');
    groups.push({ category,displayName:overview?.title||names.categories[category]||category, pages:sortByOrder(pages,order[category]||[]) });
  }
  return sortByOrder(groups,order.$categories||[],group=>group.category);
}
function warnings(source) {
  return validateDocument(source, p => {
    try { const clean = decodeURIComponent(p).replace(/^\//, ''); return !clean.split('/').some(x => ['..', '.'].includes(x)) && existsSync(path.join(root, 'public', clean)); } catch { return false; }
  });
}
function result(source, name) {
  return { ...parseDocument(source), path: name, title: pageTitle(source,'首页'), profile: source.match(/^pageClass:\s*(.*)$/m)?.[1]?.trim() || pageClass(name.split('/')[0]), warnings: warnings(source) };
}
function previewURL(name) { return `${previewOrigin}/floorball-training/${name === 'index.md' ? '' : name.replace(/index\.md$/, '').replace(/\.md$/, '').split('/').map(encodeURIComponent).join('/')}`; }
async function ensurePreview() {
  try { const response = await fetch(previewOrigin+'/floorball-training/', { signal: AbortSignal.timeout(1500) }); if (response.ok) return; } catch {}
  if (!previewProcess) {
    const entry = path.join(root, 'node_modules/vitepress/bin/vitepress.js');
    previewProcess = spawn(process.execPath, [entry, 'dev', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    previewProcess.stdout.resume();
    previewProcess.stderr.on('data', x => { previewStatus = String(x).slice(-1500); });
    previewProcess.on('exit', () => { previewProcess = undefined; });
    previewProcess.on('error', e => { previewStatus = e.message; previewProcess = undefined; });
  }
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 250));
    try { if ((await fetch(previewOrigin+'/floorball-training/', { signal: AbortSignal.timeout(800) })).ok) return; } catch {}
    if (!previewProcess) break;
  }
  throw new Problem(`网站预览启动失败，请检查项目依赖。${previewStatus}`, 503);
}
function send(res, code, data) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
async function body(req, max = 8 * 1024 * 1024) {
  if (Number(req.headers['content-length'] || 0) > max) throw new Problem('文件过大，请选择小于 256MB 的视频或图片', 413);
  const parts = []; let size = 0;
  for await (const part of req) { size += part.length; if (size > max) throw new Problem('请求内容超过大小限制', 413); parts.push(part); }
  return Buffer.concat(parts);
}
async function file(res, req, filename) {
  let info; try { info = await fs.stat(filename); } catch { throw new Problem('找不到文件', 404); }
  if (!info.isFile()) throw new Problem('找不到文件', 404);
  const headers = { 'Content-Type': mime[path.extname(filename).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0, end = info.size - 1, status = 200;
  if (range) {
    start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
    if (start > end || start >= info.size) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return; }
    headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`; status = 206;
  }
  headers['Content-Length'] = Math.max(0, end - start + 1);
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || !info.size) res.end(); else createReadStream(filename, { start, end }).pipe(res);
}
function mediaSignature(ext, data) {
  if (['.jpg', '.jpeg'].includes(ext)) return data[0] === 255 && data[1] === 216;
  if (ext === '.png') return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === '.gif') return data.toString('ascii', 0, 3) === 'GIF';
  if (ext === '.webp') return data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
  if (ext === '.webm') return data.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
  return data.toString('ascii', 4, 8) === 'ftyp';
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; media-src 'self' blob: https: http:; frame-src 'self' http://127.0.0.1:5173; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
  try {
    if (req.headers.host !== `127.0.0.1:${port}`) throw new Problem('请使用本地编辑器地址访问', 403);
    const url = new URL(req.url, origin);
    if (!['GET', 'HEAD', 'POST'].includes(req.method)) throw new Problem('不支持的操作', 405);
    if (req.method === 'POST' && (req.headers['x-editor-session'] !== token || req.headers.origin && req.headers.origin !== origin || req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) throw new Problem('请从本地编辑器发起操作', 403);
    if (url.pathname === '/api/session') return send(res, 200, { token, categories, root, version: 1 });
    if (url.pathname === '/api/tree') return send(res,200,await directoryData());
    if(url.pathname==='/api/tactics/export-status'&&req.method==='GET')return send(res,200,tactics.status(url.searchParams.get('id')));
    if(url.pathname==='/api/tactics/export-download'&&req.method==='GET'){res.setHeader('Content-Disposition','attachment; filename="floorball-tactics.mp4"');return await file(res,req,tactics.download(url.searchParams.get('id')));}
    if(url.pathname.startsWith('/api/tactics/')&&req.method==='POST'){
      if(url.pathname==='/api/tactics/export-frame')return send(res,200,await tactics.frame(url.searchParams.get('id'),Number(url.searchParams.get('index')),await body(req,8*1024*1024)));
      const data=JSON.parse((await body(req,2*1024*1024)).toString('utf8'));
      if(url.pathname==='/api/tactics/save'){await safePath('public/tactics',['public']);return send(res,200,await tactics.save(data.document));}
      if(url.pathname==='/api/tactics/export-create')return send(res,200,await tactics.createExport(data.document));
      if(url.pathname==='/api/tactics/export-finish')return send(res,202,tactics.finish(data.id));
      if(url.pathname==='/api/tactics/export-cancel')return send(res,200,tactics.cancel(data.id));
      throw new Problem('找不到战术板操作',404);
    }
    if(url.pathname==='/api/targets'&&req.method==='GET'){
      const name=url.searchParams.get('path');const filename=await pagePath(name);
      return send(res,200,await linkTargets(name,await fs.readFile(filename,'utf8')));
    }
    if (url.pathname === '/api/import-status' && req.method === 'GET') {
      const status=videoImports.status(url.searchParams.get('id'));
      if(!status)throw new Problem('找不到视频处理任务',404);
      return send(res,200,status);
    }
    if (url.pathname === '/api/page' && req.method === 'GET') {
      const name = url.searchParams.get('path'); const filename = await pagePath(name);
      return send(res, 200, result(await fs.readFile(filename, 'utf8'), name));
    }
    if (url.pathname === '/api/import' && req.method === 'POST') {
      const original = url.searchParams.get('name') || ''; const ext = path.extname(original).toLowerCase();
      if (!uploads.has(ext)) throw new Problem('请选择图片或 MP4、WebM、MOV、M4V、MKV、AVI 视频');
      const stem = path.basename(original, path.extname(original)).replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 55) || 'media';
      if(videoExtensions.has(ext)){
        await safePath('public/editor-media',['public']);
        return send(res,202,await videoImports.receive(req,ext,stem));
      }
      const bytes = await body(req, 256 * 1024 * 1024);
      if (!mediaSignature(ext, bytes)) throw new Problem('文件内容与扩展名不符，未导入');
      const name = `${stem}-${hash(bytes).slice(0, 16)}${ext}`;
      const target = await safePath(`public/editor-media/${name}`, ['public']);
      await fs.mkdir(path.dirname(target), { recursive: true });
      if (!existsSync(target)) await fs.writeFile(target, bytes, { flag: 'wx' });
      return send(res, 200, { src: `/editor-media/${name}`, kind: ['.mp4', '.webm'].includes(ext) ? 'video' : 'image' });
    }
    if (url.pathname.startsWith('/api/') && req.method === 'POST') {
      const data = JSON.parse((await body(req)).toString('utf8'));
      if(url.pathname==='/api/reparse'){
        await pagePath(data.path);
        return send(res,200,parseDocument(serializeDocument(data.document)));
      }
      if(url.pathname==='/api/targets'){
        await pagePath(data.path);
        return send(res,200,await linkTargets(data.path,serializeDocument(data.document)));
      }
      if (url.pathname === '/api/preview') {
        const name = data.path; await pagePath(name); await ensurePreview();
        return send(res, 200, { url: previewURL(name) });
      }
      if (url.pathname === '/api/render') {
        const source = serializeDocument(data.document);
        const profile = String(data.profile || 'technical-reading').replace(/[^\w -]/g, '');
        const { body: markdown } = splitFrontmatter(source);
        return send(res, 200, { html: await siteRender(markdown, data.path), profile, warnings: warnings(source) });
      }
      if (!['/api/save', '/api/create','/api/ensure-anchor','/api/order','/api/category-order','/api/rename','/api/groups'].includes(url.pathname)) throw new Problem('找不到操作', 404);
      if (saving) throw new Problem('正在保存另一个页面，请稍后重试', 409);
      saving = true;
      try {
        if(url.pathname==='/api/category-order'){
          const order=await readOrder();if(data.version!==order.version)throw new Problem('目录已在其他窗口更新，已重新加载，请再调整一次。',409);
          const available=(await tree(order.data)).map(group=>group.category);
          if(!Array.isArray(data.categories)||data.categories.length!==available.length||new Set(data.categories).size!==available.length||data.categories.some(category=>!available.includes(category)))throw new Problem('一级目录排序不能遗漏、重复或加入其他栏目');
          order.data.$categories=data.categories;await fs.mkdir(path.dirname(orderFile),{recursive:true});await atomicWrite(orderFile,JSON.stringify(order.data,null,2)+'\n');
          return send(res,200,await directoryData());
        }
        if(url.pathname==='/api/groups'){
          if(!categories.includes(data.category))throw new Problem('请选择有效栏目');
          if(!(await fs.stat(await safePath(data.category))).isDirectory())throw new Problem('栏目不存在');
          const stored=await readGroups();if(stored.version!==data.version)throw new Problem('目录分组已在其他窗口更新，请重新操作。',409);
          const folders=stored.data[data.category]||[];
          if(data.action==='create'||data.action==='rename'){
            const name=directoryName(data.name);
            if(folders.some(g=>(data.action!=='rename'||g.id!==data.id)&&normalizedName(g.name)===normalizedName(name)))throw new Problem('栏目中已经有这个分组名称。');
            if(data.action==='create')folders.push({id:'group-'+randomBytes(8).toString('hex'),name,pages:[]});
            else{const folder=folders.find(g=>g.id===data.id);if(!folder)throw new Problem('分组不存在');folder.name=name;}
          }else if(data.action==='move'){
            const pages=(await tree()).find(g=>g.category===data.category)?.pages||[];
            if(!pages.some(p=>p.path===data.path))throw new Problem('只能移动同一栏目下的现有页面');
            const folder=data.id?folders.find(g=>g.id===data.id):null;
            if(data.id&&!folder)throw new Problem('目标分组不存在');
            for(const group of folders)group.pages=group.pages.filter(p=>p!==data.path);
            if(folder)folder.pages.push(data.path);
          }else if(data.action==='order'){
            if(!Array.isArray(data.ids)||data.ids.length!==folders.length||new Set(data.ids).size!==folders.length||data.ids.some(id=>!folders.some(g=>g.id===id)))throw new Problem('分组排序不能遗漏、重复或跨栏目');
            folders.sort((a,b)=>data.ids.indexOf(a.id)-data.ids.indexOf(b.id));
          }else throw new Problem('不支持的分组操作');
          stored.data[data.category]=folders;
          await fs.mkdir(path.dirname(groupsFile),{recursive:true});await atomicWrite(groupsFile,JSON.stringify(stored.data,null,2)+'\n');
          return send(res,200,await directoryData());
        }
        if(url.pathname==='/api/rename'){
          const names=await readNames();if(names.version!==data.version)throw new Problem('目录名称已在其他窗口更新，请重试。',409);
          const name=String(data.name||'').trim();if(!name||name.length>80||/[<>\x00-\x1f]/.test(name))throw new Problem('名称不能为空，最多80字，不能包含换行或尖括号。');
          const normalize=s=>s.normalize('NFKC').toLocaleLowerCase('zh-CN');
          const groups=await tree(undefined,names.data);let candidates=[];
          if(data.kind==='category'){
            if(!categories.includes(data.key))throw new Problem('请选择现有栏目');
            if(!(await fs.stat(await safePath(data.key))).isDirectory())throw new Problem('栏目不存在');
            candidates=groups.filter(g=>g.category!==data.key).map(g=>g.displayName);names.data.categories[data.key]=name;
          }else if(data.kind==='page'){
            await fs.stat(await pagePath(data.key));
            candidates=(groups.find(g=>data.key.startsWith(g.category+'/'))?.pages||[]).filter(p=>p.path!==data.key).map(p=>p.title);names.data.pages[data.key]=name;
          }else throw new Problem('请选择页面或栏目');
          if(candidates.some(value=>normalize(value)===normalize(name)))throw new Problem('同一目录下已经有这个名称，请换一个名称。');
          const target=data.kind==='category'?data.key+'/index.md':data.key;
          const filename=await pagePath(target);let source;try{source=await fs.readFile(filename,'utf8');}catch(e){if(e.code!=='ENOENT'||data.kind!=='category')throw e;}
          if(source!==undefined){
            if(data.pageVersion&&hash(source)!==data.pageVersion)throw new Problem('页面标题已在其他地方修改，请重新打开页面。',409);
            const doc=parseDocument(source),heading=doc.blocks.find(block=>block.type==='heading'&&block.meta.level===1);
            if(heading){const anchor=heading.raw.match(/\s+(\{#[^}]+\})\s*$/)?.[1];heading.raw='# '+md.utils.escapeHtml(name).replace(/[\\`*_\[\]]/g,'\\$&')+(anchor?' '+anchor:'')+(heading.raw.endsWith('\r\n')?'\r\n':'\n');}
            else doc.blocks.unshift({type:'heading',meta:{level:1},prefix:'',raw:'# '+md.utils.escapeHtml(name).replace(/[\\`*_\[\]]/g,'\\$&')+'\n\n'});
            await atomicWrite(filename,serializeDocument(doc));
          }
          await fs.mkdir(path.dirname(namesFile),{recursive:true});await atomicWrite(namesFile,JSON.stringify(names.data,null,2)+'\n');
          return send(res,200,await directoryData());
        }
        if(url.pathname==='/api/order'){
          if(!categories.includes(data.category)||!Array.isArray(data.paths))throw new Problem('请选择有效栏目');
          const order=await readOrder();if(data.version!==order.version)throw new Problem('目录已在其他窗口更新，已重新加载，请再调整一次。',409);
          const groups=await tree(order.data);const available=groups.find(g=>g.category===data.category)?.pages.map(p=>p.path)||[];
          if(data.paths.length!==available.length||new Set(data.paths).size!==available.length||data.paths.some(p=>!available.includes(p)))throw new Problem('只能调整同一栏目中的页面，且不能遗漏或重复页面');
          order.data[data.category]=data.paths;await fs.mkdir(path.dirname(orderFile),{recursive:true});await atomicWrite(orderFile,JSON.stringify(order.data,null,2)+'\n');
          return send(res,200,await directoryData());
        }
        if(url.pathname==='/api/ensure-anchor'){
          const filename=await pagePath(data.path);const source=await fs.readFile(filename,'utf8');
          if(hash(source)!==data.version)throw new Problem('目标页面已经修改，请重新选择链接目标。',409);
          const doc=parseDocument(source);const index=data.blockIndex;const block=doc.blocks[index];
          if(!Number.isInteger(index)||!block)throw new Problem('目标区块不存在');
          const existing=blockAnchor(doc,index);const expected=existing||'editor-block-'+hash(data.path+'\0'+index+'\0'+block.raw).slice(0,16);
          if(data.id!==expected)throw new Problem('区块定位信息不正确');
          if(!existing){block.prefix=(block.prefix||'\n\n')+`<div id="${expected}"></div>\n\n`;await atomicWrite(filename,serializeDocument(doc));}
          return send(res,200,{id:expected});
        }
        if (url.pathname === '/api/create') {
          if (!categories.includes(data.category)) throw new Problem('请选择现有栏目');
          let storedGroups,folder;
          if(data.group){storedGroups=await readGroups();if(storedGroups.version!==data.groupsVersion)throw new Problem('目录分组已经更新，请重新选择。',409);folder=storedGroups.data[data.category]?.find(g=>g.id===data.group);if(!folder)throw new Problem('所选分组不存在');}
          const title = String(data.title || '').trim();
          if (!title || title.length > 80 || /[<>:"/\\|?*\x00-\x1f]/.test(title) || /[. ]$/.test(title) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(title)) throw new Problem('标题不能为空，且不能包含文件名特殊字符');
          const name = `${data.category}/${title}.md`; const filename = await pagePath(name);
          if (existsSync(filename)) throw new Problem('同名页面已存在，请换一个标题', 409);
          const source = `---\npageClass: ${pageClass(data.category, title + '.md')}\n---\n\n# ${title}\n\n`;
          const entries = await readRegistry(); entries.push({ category: data.category, path: name, title });
          await fs.mkdir(path.dirname(registry), { recursive: true });
          await fs.writeFile(filename, source, { flag: 'wx' });
          try { await atomicWrite(registry, JSON.stringify(entries, null, 2) + '\n'); }
          catch { throw new Problem('页面已创建，但栏目目录登记失败。请联系维护者补充目录，不要再次新建同名页面。', 500); }
          if(folder){folder.pages.push(name);try{await atomicWrite(groupsFile,JSON.stringify(storedGroups.data,null,2)+'\n');}catch{throw new Problem('页面已创建在栏目下，但加入分组失败。请刷新目录后移动页面，不要重复创建。',500);}}
          return send(res, 200, result(source, name));
        }
        const filename = await pagePath(data.path); const current = await fs.readFile(filename, 'utf8');
        if (data.version !== hash(current)) throw new Problem('这个页面已在其他地方修改。请先复制未保存的文字，再重新打开页面，避免覆盖新内容。', 409);
        if (data.document.frontmatter !== splitFrontmatter(current).frontmatter) throw new Problem('页面设置已变化，请重新打开后再保存', 409);
        const source = serializeDocument(data.document);
        if (source !== current) await atomicWrite(filename, source);
        return send(res, 200, { ...result(source, data.path), saved: true, unchanged: source === current });
      } finally { saving = false; }
    }
    if (url.pathname === '/site.css') return await file(res, req, path.join(root, '.vitepress/theme/custom.css'));
    if (['/vars.css','/custom-block.css','/vp-code.css'].includes(url.pathname)) {
      const name = url.pathname.slice(1);
      return await file(res, req, path.join(root, 'node_modules/vitepress/dist/client/theme-default/styles', name === 'vars.css' ? '' : 'components', name));
    }
    if (url.pathname === '/base.css') return await file(res, req, path.join(root, 'node_modules/vitepress/dist/client/theme-default/styles/base.css'));
    if (url.pathname === '/doc.css') return await file(res, req, path.join(root, 'node_modules/vitepress/dist/client/theme-default/styles/components/vp-doc.css'));
    if (url.pathname.startsWith('/media/')) {
      const asset = decodeURIComponent(url.pathname.slice(7));
      if (!mime[path.extname(asset).toLowerCase()]) throw new Problem('不支持预览该文件', 404);
      return await file(res, req, await safePath(`public/${asset}`, ['public']));
    }
    if(url.pathname.startsWith('/tactics-runtime/')){const name=url.pathname.slice('/tactics-runtime/'.length);if(!['model.js','render.js','player.js','player.css'].includes(name))throw new Problem('找不到文件',404);return await file(res,req,path.join(here,'../public/tactics-runtime',name));}
    const assets = { '/': 'index.html', '/app.js': 'app.js', '/editor.css': 'editor.css', '/serialize.js': 'serialize.js', '/table.js':'table.js', '/navigation.js':'navigation.js', '/element.js':'element.js', '/github.js':'github.js', '/text-target.js':'text-target.js', '/block-clipboard.js':'block-clipboard.js', '/tactics.js':'tactics.js','/tactics.css':'tactics.css','/preview.html': 'preview.html', '/preview.js': 'preview.js' };
    if (assets[url.pathname]) return await file(res, req, path.join(here, 'web', assets[url.pathname]));
    throw new Problem('找不到页面', 404);
  } catch (error) { if (!res.headersSent) send(res, error.status || (error.code === 'ENOENT' ? 404 : 500), { error: error instanceof SyntaxError ? '请求格式不正确' : error.message }); else res.end(); }
});
function openBrowser() { if (process.platform === 'win32') spawn('cmd.exe', ['/d', '/c', 'start', '', origin], { windowsHide: true, stdio: 'ignore' }); }
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try { const data = await (await fetch(`${origin}/api/session`)).json(); if (data.version === 1 && data.root === root) { if (process.argv.includes('--open')) openBrowser(); return; } } catch {}
  }
  console.error('编辑器启动失败：', error.message); process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => { console.log(`内容编辑器已启动：${origin}`); if (process.argv.includes('--open')) openBrowser(); });
process.on('SIGINT', () => { previewProcess?.kill(); server.close(); });
process.on('SIGTERM', () => { previewProcess?.kill(); server.close(); });
if(process.env.FLOORBALL_EDITOR_DESKTOP==='1'&&process.send){
  let shuttingDown=false;
  const shutdown=()=>{if(shuttingDown)return;shuttingDown=true;previewProcess?.kill();server.close(()=>process.exit(0));server.closeIdleConnections();setTimeout(()=>process.exit(0),3000).unref();};
  process.on('message',message=>{if(message?.type==='floorball-desktop-shutdown')shutdown();});
  process.on('disconnect',shutdown);
}
