import { sanitize, safeURL, localMedia, htmlMarkdown, richPasteHTML } from './serialize.js';
import { decorateTable, focusCell, changeTable } from './table.js';
import { resolveLink } from './navigation.js';
import { titledTypes, updateElementSource } from './element.js';
import { TacticsWorkbench,tacticsBlock } from './tactics.js';
import { mountTactics } from '/tactics-runtime/player.js';
import { textTarget,textTargetURL,highlightText } from './text-target.js';
import { encodeBlock,decodeBlock } from './block-clipboard.js';

const $ = s => document.querySelector(s);
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { token: '', groups: [], page: null, saved: '', selected: -1, dirty: false, undo: [], redo: [], dark: false, previewId: 0 };
let selection; let previewTimer; let toastTimer; let busy = false; let queue = []; let gallery = false; let editingMedia = -1;
let mediaPosition; let mediaPagePath; let mediaImporting=false;
let tableCell=null;
let linkMode='page',linkChoice=null,linkPage='',linkRequest=0,linkRange=null,linkField=null,linkTextManual=false;
let editingLink=null;let previewNavigation=null;const sourceStack=[];let linkNavigationBusy=false;
let ordering=false,dragPage='',dragEnded=0;state.orderVersion='';
let renameTarget=null;let movingPage='';let grouping=false;state.namesVersion='';state.groupsVersion='';state.homeName='网站首页';
const labels = { heading:'标题', text:'正文', list:'列表', table:'表格', callout:'提示框', quote:'引用', image:'图片', video:'视频', gallery:'并排媒体', tactics:'战术板',divider:'分隔线', raw:'保留内容' };
const contentJSON = () => JSON.stringify(state.page && { frontmatter: state.page.frontmatter, blocks: state.page.blocks, tail: state.page.tail });
function toast(text, error = false) { $('#toast').textContent = text; $('#toast').className = 'show' + (error ? ' error' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').className = '', error ? 9000 : 3500); }
async function api(url, data, options = {}) {
  const init = data === undefined ? {} : { method:'POST', headers:{ 'Content-Type':'application/json', 'X-Editor-Session':state.token }, body:JSON.stringify(data) };
  const response = await fetch(url, { ...init, ...options }); const result = await response.json();
  if (!response.ok) throw new Error(result.error || '操作失败，请重试'); return result;
}
const tacticsWorkbench=new TacticsWorkbench({api,token:()=>state.token,toast});
function record() { if (!state.page) return; state.undo.push(contentJSON()); if (state.undo.length > 150) state.undo.shift(); state.redo = []; }
function changed() {
  state.dirty = contentJSON() !== state.saved;
  $('#save-state').textContent = state.dirty ? '未保存' : '已保存到本机'; $('#save-state').className = 'status' + (state.dirty ? ' unsaved' : '');
  $('#undo').disabled = !state.undo.length; $('#redo').disabled = !state.redo.length;
  document.title = `${state.dirty ? '● ' : ''}${state.page?.title || '软曲'} · 内容编辑器`;
  clearTimeout(previewTimer); previewTimer = setTimeout(updatePreview, 400);
  if (state.page) { try { localStorage.setItem('floorball-editor-draft:' + state.page.path, JSON.stringify({ version:state.page.version, document:JSON.parse(contentJSON()), updated:Date.now() })); } catch {} }
  reportDesktopState();
}
function undo(redo = false) {
  const from = redo ? state.redo : state.undo, to = redo ? state.undo : state.redo;
  if (!from.length) return;
  to.push(contentJSON()); Object.assign(state.page, JSON.parse(from.pop())); renderBlocks(); changed();
}
function drawTree() {
  const query = $('#search').value.toLowerCase(); const tree = $('#tree');const open=new Set([...tree.querySelectorAll('details[open]')].map(d=>d.dataset.folder||d.dataset.category));const scroll=tree.scrollTop; tree.replaceChildren();
  const home = document.createElement('button'); home.className = 'tree-page home-page'; home.textContent = '⌂  '+state.homeName; home.onclick = () => loadPage('index.md');home.oncontextmenu=e=>{e.preventDefault();openRename('page','index.md',state.homeName);};home.onkeydown=e=>{if(e.key==='F2'){e.preventDefault();openRename('page','index.md',state.homeName);}}; tree.append(home);
  for (const group of state.groups) {
    const matches=p=>(p.title+p.path+(group.displayName||group.category)+(group.folders?.find(f=>f.pages.includes(p.path))?.name||'')).toLowerCase().includes(query);
    const pages = group.pages.filter(matches); if (!pages.length&&query&&!(group.displayName||group.category).toLowerCase().includes(query)&&!group.folders?.some(f=>f.name.toLowerCase().includes(query))) continue;
    const details = document.createElement('details');details.dataset.category=group.category; details.open = !!query || open.has(group.category) || state.page?.path.startsWith(group.category + '/') || !state.page && group.category === '个人技术基础';
    const summary = document.createElement('summary'); summary.textContent = group.displayName||group.category;summary.oncontextmenu=e=>{e.preventDefault();openRename('category',group.category,group.displayName||group.category);};summary.onkeydown=e=>{if(e.key==='F2'){e.preventDefault();openRename('category',group.category,group.displayName||group.category);}};const count = document.createElement('span'); count.textContent = pages.length;const rename=document.createElement('button');rename.type='button';rename.className='rename-category';rename.textContent='✎';rename.title='修改栏目名称';rename.setAttribute('aria-label','修改栏目名称');rename.onclick=e=>{e.stopPropagation();e.preventDefault();openRename('category',group.category,group.displayName||group.category);}; summary.append(count,rename); details.append(summary);
    summary.title='Alt+↑/↓ 调整一级目录顺序 · F2 改名';
    summary.onkeydown=e=>{if(e.target!==summary)return;if(e.key==='F2'){e.preventDefault();openRename('category',group.category,group.displayName||group.category);}else if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();orderCategory(group.category,e.key==='ArrowUp'?-1:1);}};
    for(const [text,title,offset] of [['↑','一级目录上移',-1],['↓','一级目录下移',1]]){const button=document.createElement('button');button.type='button';button.className='tree-action order-category';button.textContent=text;button.title=title;button.setAttribute('aria-label',title);const position=state.groups.indexOf(group);button.disabled=position+offset<0||position+offset>=state.groups.length;button.onclick=e=>{e.preventDefault();e.stopPropagation();orderCategory(group.category,offset);};summary.append(button);}
    summary.ondragover=e=>directoryDragOver(e,summary);
    summary.ondragleave=()=>summary.classList.remove('group-drop');
    summary.ondrop=e=>dropInFolder(e,group.category,'',summary);
    const add=document.createElement('button');add.type='button';add.className='tree-action';add.textContent='+';add.title='新建分组';add.setAttribute('aria-label','新建分组');add.onclick=e=>{e.preventDefault();e.stopPropagation();openGroup(group.category);};summary.append(add);
    function appendPage(page,parent,siblings){ const b = document.createElement('button'); b.className = 'tree-page sortable-page' + (state.page?.path === page.path ? ' current' : ''); b.textContent = page.title; b.title = page.title+' · 拖动排序，或 Alt+↑/↓';b.dataset.path=page.path;b.draggable=true;b.onclick=()=>{if(Date.now()-dragEnded>250)loadPage(page.path)};
      b.ondragstart=e=>{if(ordering){e.preventDefault();return;}dragPage=page.path;e.dataTransfer.setData('application/x-floorball-page',page.path);e.dataTransfer.effectAllowed='move';b.classList.add('page-dragging');};
      b.ondragover=e=>{if(!Array.from(e.dataTransfer.types).includes('application/x-floorball-page'))return;e.preventDefault();e.dataTransfer.dropEffect='move';const rect=b.getBoundingClientRect();b.dataset.drop=e.clientY<rect.top+rect.height/2?'before':'after';};
      b.ondragleave=()=>delete b.dataset.drop;
      b.ondrop=e=>{if(!Array.from(e.dataTransfer.types).includes('application/x-floorball-page'))return;e.preventDefault();e.stopPropagation();const source=e.dataTransfer.getData('application/x-floorball-page')||dragPage;const after=b.dataset.drop==='after';delete b.dataset.drop;moveDirectoryPage(group.category,source,page.path,after);};
      b.ondragend=()=>{dragPage='';dragEnded=Date.now();tree.querySelectorAll('[data-drop]').forEach(e=>delete e.dataset.drop);b.classList.remove('page-dragging');};
      b.oncontextmenu=e=>{e.preventDefault();openRename('page',page.path,page.title);};
      b.onkeydown=e=>{if(e.key==='F2'){e.preventDefault();openRename('page',page.path,page.title);return;}if(!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const index=siblings.findIndex(p=>p.path===page.path);const other=siblings[index+(e.key==='ArrowUp'?-1:1)];if(other)moveDirectoryPage(group.category,page.path,other.path,e.key==='ArrowDown');};
      const row=document.createElement('div');row.className='tree-row';const rename=document.createElement('button');rename.type='button';rename.className='rename-page';rename.textContent='✎';rename.title='修改目录名称';rename.setAttribute('aria-label','修改目录名称');rename.onclick=()=>openRename('page',page.path,page.title);
      const move=document.createElement('button');move.type='button';move.className='tree-action move-page';move.textContent='↳';move.title='移入分组 / 移回栏目';move.setAttribute('aria-label','移动页面');move.onclick=()=>openMove(group,page.path);row.append(b,move,rename);parent.append(row); }
    const children=group.children||group.pages.map(page=>({type:'page',page}));
    const rootPages=children.filter(n=>n.type==='page').map(n=>n.page);
    for(const node of children){
      if(node.type==='page'){if(matches(node.page))appendPage(node.page,details,rootPages);continue;}
      const visible=node.pages.filter(matches);if(query&&!visible.length&&!node.name.toLowerCase().includes(query))continue;
      const folder=document.createElement('details');folder.className='tree-folder';folder.dataset.folder=node.id;folder.open=!!query||open.has(node.id)||node.pages.some(p=>p.path===state.page?.path);
      const head=document.createElement('summary');const name=document.createElement('label');name.textContent=node.name;head.append(name);head.title='拖入页面归组 · F2 改名 · Alt+↑/↓ 排序';
      const rename=()=>openRename('group',node.id,node.name,group.category);
      head.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();rename();};head.onkeydown=e=>{e.stopPropagation();if(e.key==='F2'){e.preventDefault();rename();}else if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();orderFolder(group,node.id,e.key==='ArrowUp'?-1:1);}};
      const actions=[['✎','修改分组名称',rename],['↑','分组上移',()=>orderFolder(group,node.id,-1)],['↓','分组下移',()=>orderFolder(group,node.id,1)],['+','在分组下新建页面',()=>openNewPage(group.category,node.id)]];
      for(const [text,title,handler] of actions){const button=document.createElement('button');button.type='button';button.className='tree-action';button.textContent=text;button.title=title;button.setAttribute('aria-label',title);button.onclick=e=>{e.preventDefault();e.stopPropagation();handler();};head.append(button);}
      head.ondragover=e=>directoryDragOver(e,head);head.ondragleave=()=>head.classList.remove('group-drop');head.ondrop=e=>dropInFolder(e,group.category,node.id,head);
      folder.append(head);for(const page of visible)appendPage(page,folder,node.pages);if(!node.pages.length){const empty=document.createElement('p');empty.className='empty-group';empty.textContent='拖入页面，或点 + 新建';folder.append(empty);}details.append(folder);
    }
    tree.append(details);
  }
  tree.scrollTop=scroll;
}
function adoptDirectory(data){state.groups=data.groups;state.orderVersion=data.orderVersion;state.namesVersion=data.namesVersion;state.groupsVersion=data.groupsVersion;state.homeName=data.homeName||'网站首页';drawTree();for(const id of ['new-category','group-category']){const select=$('#'+id),selected=select.value;select.replaceChildren(...state.groups.map(group=>new Option(group.displayName||group.category,group.category)));if(state.groups.some(group=>group.category===selected))select.value=selected;}updateNewGroups();if(state.page)$('#breadcrumb').textContent=(state.groups.find(g=>state.page.path.startsWith(g.category+'/'))?.displayName||'网站')+' / 内容编辑';}
async function orderCategory(category,offset){
  if(ordering)return;const categories=state.groups.map(group=>group.category),from=categories.indexOf(category),to=from+offset;if(from<0||to<0||to>=categories.length)return;
  [categories[from],categories[to]]=[categories[to],categories[from]];ordering=true;
  try{adoptDirectory(await api('/api/category-order',{categories,version:state.orderVersion}));document.querySelector(`details[data-category="${CSS.escape(category)}"]>summary`)?.focus({preventScroll:true});toast('一级目录顺序已保存，网站导航已同步。');}
  catch(e){toast(e.message,true);await refreshTree();}finally{ordering=false;document.querySelectorAll('.order-category').forEach(button=>{const row=button.closest('details');const position=state.groups.findIndex(group=>group.category===row.dataset.category);button.disabled=button.textContent==='↑'?position===0:position===state.groups.length-1;});}
}
async function refreshTree() { adoptDirectory(await api('/api/tree')); }
function openRename(kind,key,name,category){renameTarget={kind,key,category};$('#rename-title').textContent=kind==='category'?'修改栏目名称':kind==='group'?'修改分组名称':'修改目录名称';$('#rename-name').value=name;$('#rename-dialog').showModal();$('#rename-name').select();}
$('#rename-form').onsubmit=async e=>{e.preventDefault();const target=renameTarget.kind==='category'?renameTarget.key+'/index.md':renameTarget.kind==='page'?renameTarget.key:'';const active=target===state.page?.path;if(active&&state.dirty){toast('请先保存当前页面，再修改标题。',true);return;}const button=e.submitter||e.currentTarget.querySelector('[type=submit]');button.disabled=true;try{const data=renameTarget.kind==='group'?await api('/api/groups',{action:'rename',category:renameTarget.category,id:renameTarget.key,name:$('#rename-name').value,version:state.groupsVersion}):await api('/api/rename',{...renameTarget,name:$('#rename-name').value,version:state.namesVersion,pageVersion:active?state.page.version:undefined});adoptDirectory(data);$('#rename-dialog').close();if(active)await loadPage(target,true);toast('名称已保存，页面主标题与目录已同步。');}catch(error){toast(error.message,true);await refreshTree();}finally{button.disabled=false;}};
async function moveDirectoryPage(category,source,target,after){
  if(ordering||source===target)return;const group=state.groups.find(g=>g.category===category);
  if(!group?.pages.some(p=>p.path===source))return toast('请在同一栏目内调整页面顺序。');
  const folderOf=page=>group.folders?.find(f=>f.pages.includes(page))?.id||'';
  if(folderOf(source)!==folderOf(target))return toast('跨分组移动请拖到分组标题，或使用页面旁的移动按钮。');
  const paths=group.pages.map(p=>p.path).filter(p=>p!==source);const index=paths.indexOf(target);if(index<0)return;paths.splice(index+(after?1:0),0,source);
  ordering=true;try{const data=await api('/api/order',{category,paths,version:state.orderVersion});adoptDirectory(data);document.querySelector(`.tree-page[data-path="${CSS.escape(source)}"]`)?.focus({preventScroll:true});toast('目录顺序已保存，网站侧边目录已同步。');}
  catch(e){toast(e.message,true);await refreshTree();}finally{ordering=false;}
}
async function groupOperation(data){
  if(grouping)return false;grouping=true;
  try{adoptDirectory(await api('/api/groups',{...data,version:state.groupsVersion}));return true;}
  catch(e){toast(e.message,true);await refreshTree();return false;}finally{grouping=false;}
}
function directoryDragOver(e,head){if(!Array.from(e.dataTransfer.types).includes('application/x-floorball-page'))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';head.classList.add('group-drop');}
async function dropInFolder(e,category,id,head){if(!Array.from(e.dataTransfer.types).includes('application/x-floorball-page'))return;e.preventDefault();e.stopPropagation();head.classList.remove('group-drop');const page=e.dataTransfer.getData('application/x-floorball-page');if(await groupOperation({action:'move',category,id,path:page}))toast(id?'页面已移入分组。':'页面已移回栏目。');}
function openGroup(category){const current=state.page?.path.split('/')[0];$('#group-category').value=category||(state.groups.some(g=>g.category===current)?current:state.groups[0]?.category);$('#group-name').value='';$('#group-dialog').showModal();$('#group-name').focus();}
async function orderFolder(group,id,offset){const ids=group.folders.map(f=>f.id);const from=ids.indexOf(id),to=from+offset;if(to<0||to>=ids.length)return;[ids[from],ids[to]]=[ids[to],ids[from]];if(await groupOperation({action:'order',category:group.category,ids})){document.querySelector(`details[data-folder="${CSS.escape(id)}"]>summary`)?.focus();toast('分组顺序已保存。');}}
function updateNewGroups(selected){const select=$('#new-group');const previous=selected??select.value;select.replaceChildren(new Option('直接放在栏目下',''));for(const folder of state.groups.find(g=>g.category===$('#new-category').value)?.folders||[])select.add(new Option(folder.name,folder.id));select.value=[...select.options].some(o=>o.value===previous)?previous:'';}
function openNewPage(category,id){$('#new-title').value='';if(category)$('#new-category').value=category;updateNewGroups(id||'');$('#new-dialog').showModal();}
function openMove(group,path){movingPage=path;$('#move-page-name').textContent=group.pages.find(p=>p.path===path)?.title||path;$('#move-group').replaceChildren(new Option('直接放在栏目下',''));for(const folder of group.folders||[])$('#move-group').add(new Option(folder.name,folder.id));$('#move-group').value=group.folders?.find(f=>f.pages.includes(path))?.id||'';$('#move-dialog').showModal();}
$('#new-group-button').onclick=()=>openGroup();
$('#new-category').onchange=()=>updateNewGroups('');
$('#group-form').onsubmit=async e=>{e.preventDefault();if(await groupOperation({action:'create',category:$('#group-category').value,name:$('#group-name').value})){$('#group-dialog').close();toast('分组已创建，可拖入页面或在分组下新建。');}};
$('#move-form').onsubmit=async e=>{e.preventDefault();if(await groupOperation({action:'move',category:movingPage.split('/')[0],path:movingPage,id:$('#move-group').value})){$('#move-dialog').close();toast('页面位置已保存。');}};
async function loadPage(path, skipConfirm = false) {
  if (!skipConfirm && state.dirty && !confirm('当前页面尚未保存，离开前需要保存吗？\n点击“取消”留在当前页面保存；点击“确定”切换，草稿仍保留在这台电脑。')) return;
  try {
    const page = await api('/api/page?path=' + encodeURIComponent(path));
    const draft=readDraft(path,page);
    adoptPage(page); const saved = state.saved;
    try {
      if (draft && JSON.stringify(draft.document) !== saved && confirm('这篇页面有本机未保存草稿，是否恢复？')) {const {frontmatter,blocks,tail}=await api('/api/reparse',{path,document:draft.document});Object.assign(state.page,{frontmatter,blocks,tail});renderBlocks();changed();}
    } catch {}
  } catch (e) { toast(e.message, true); }
}
function sourceText(doc){return doc.frontmatter+doc.blocks.map(b=>(b.prefix??'\n\n')+(b.raw??'')).join('')+(doc.tail||'');}
function readDraft(path,page){try{const d=JSON.parse(localStorage.getItem('floorball-editor-draft:'+path));return d?.version===page.version&&sourceText(d.document)!==sourceText(page)?d:null;}catch{return null;}}
function currentSnapshot(){return {page:structuredClone(state.page),saved:state.saved,undo:structuredClone(state.undo),redo:structuredClone(state.redo),selected:state.selected,y:window.scrollY,previewY:$('#preview').contentWindow.scrollY};}
function returnButton(){const b=$('#return-source');b.hidden=!sourceStack.length;b.textContent=sourceStack.length?'← 返回原文 · '+sourceStack.at(-1).page.title:'← 返回原文';}
async function navigateLink(href){
  if(!state.page||linkNavigationBusy)return;
  const target=resolveLink(safeURL(href),state.page.path,['index.md',...state.groups.flatMap(g=>g.pages.map(p=>p.path)),state.page.path],location.origin);
  if(!target)return toast('链接地址无效。',true);
  if(target.type==='external'){window.open(target.href,'_blank','noopener,noreferrer');return;}
  linkNavigationBusy=true;hideLinkEditor();
  try{
    let page;
    if(target.path!==state.page.path){page=await api('/api/page?path='+encodeURIComponent(target.path));const draft=readDraft(target.path,page);if(draft){const {frontmatter,blocks,tail}=await api('/api/reparse',{path:target.path,document:draft.document});page={...page,_draft:{frontmatter,blocks,tail}};}}
    sourceStack.push(currentSnapshot());if(sourceStack.length>30)sourceStack.shift();
    if(page){const draft=page._draft;delete page._draft;adoptPage(page);if(draft){Object.assign(state.page,draft);renderBlocks();changed();}}
    returnButton();await locateLinkTarget(target.hash);
  }catch(e){toast('无法打开链接：'+e.message,true);}finally{linkNavigationBusy=false;}
}
async function locateLinkTarget(hash){
  previewNavigation=hash?{hash}:{y:0};
  if(!hash){window.scrollTo(0,0);updatePreview();return;}
  const passage=textTarget(hash);const data=await api('/api/targets',{path:state.page.path,document:JSON.parse(contentJSON())});const target=data.targets.find(t=>t.id===passage.anchor);
  const section=target&&document.querySelector(`.editor-block[data-index="${target.blockIndex}"]`);
  if(section){section.scrollIntoView({block:'center',behavior:'instant'});section.classList.add('link-arrival');if(passage.text&&!highlightText(section.querySelector('.rich-field')||section,passage))toast('目标文字已改变，已定位到所在区块。');setTimeout(()=>section.classList.remove('link-arrival'),2000);}else toast('已打开页面，未找到原链接的区块。');
  updatePreview();
}
function returnToSource(){
  if(!sourceStack.length||linkNavigationBusy)return;
  const snapshot=sourceStack.pop();adoptPage(snapshot.page);state.saved=snapshot.saved;state.undo=snapshot.undo;state.redo=snapshot.redo;state.selected=snapshot.selected;changed();returnButton();window.scrollTo(0,snapshot.y);previewNavigation={y:snapshot.previewY};updatePreview();
}
function hideLinkEditor(){$('#link-edit-popover')?.setAttribute('hidden','');}
function showLinkEditor(anchor){
  if(!anchor.closest('.rich-field'))return;const panel=$('#link-edit-popover');panel._anchor=anchor;panel.hidden=false;const r=anchor.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(innerWidth-235,r.left))+'px';panel.style.top=Math.min(innerHeight-50,r.bottom+5)+'px';
  anchor.title='点击跳转；悬停后可编辑链接文字和目标';
}
function adoptPage(page) {
  if(window.floorballDesktop)try{localStorage.setItem('floorball-desktop-last-page',page.path);}catch{}
  state.page = page; state.selected = -1; state.undo = []; state.redo = []; state.dirty = false;
  $('#welcome').hidden = true; $('#add-bar').hidden = false;
  $('#current-title').textContent = page.title; $('#breadcrumb').textContent = page.path === 'index.md' ? '网站 / 首页' : (state.groups.find(g=>page.path.startsWith(g.category+'/'))?.displayName||page.path.split('/')[0]) + ' / 内容编辑';
  selection=null;editingLink=null;hideLinkEditor();renderBlocks(); state.saved = contentJSON(); drawTree(); showWarnings(page.warnings); changed(); $('#save').disabled = false; window.scrollTo(0,0);returnButton();
}
function editable(html, placeholder = '点击输入文字…') {
  const d = document.createElement('div'); d.className = 'rich-field'; d.contentEditable = 'true'; d.dataset.placeholder = placeholder; d.setAttribute('role', 'textbox'); d.setAttribute('aria-label', placeholder); d.spellcheck = false; d.innerHTML = sanitize(html, false);
  d.addEventListener('paste', e => { e.preventDefault(); const h = e.clipboardData.getData('text/html'); if (h) document.execCommand('insertHTML', false, richPasteHTML(h)); else document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); });
  return d;
}
function mediaParts(b) {
  if (b.items) return b.items;
  const raw = (b.contentRaw??b.raw).replace(/^:::\s*media-grid[^\n]*\n/, '').replace(/\n:::\s*$/, '');
  const regex = /<video\b[^>]*>[\s\S]*?<\/video>|!\[[^\]]*\]\([^\n]+\)|<img\b[^>]*>/gi;
  const matches = [...raw.matchAll(regex)]; const items = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]; const original = m[0]; const isMarkdown = original.startsWith('![');
    const mdImage = isMarkdown && original.match(/^!\[([^\]]*)\]\((.*)\)$/);
    const src = mdImage ? mdImage[2] : original.match(/\bsrc=["']([^"']+)["']/i)?.[1] || '';
    const caption = raw.slice(m.index + original.length, matches[i+1]?.index ?? raw.length).trim().replace(/\\\s*$/, '');
    items.push({ original, src, caption, alt:mdImage?.[1] || '', kind:original.startsWith('<video') ? 'video' : 'image' });
  }
  return items;
}
function renderBlocks() {
  const target = $('#blocks'); target.replaceChildren(); if (!state.page) return;
  state.page.blocks.forEach((b, index) => {
    if(/^\s*<div id="editor-block-[a-f0-9]+"><\/div>\s*$/.test(b.raw))return;
    const section = document.createElement('section'); section.className = `editor-block block-${b.type}`; section.dataset.index = index;
    const bar = document.createElement('div'); bar.className = 'block-bar';bar.tabIndex=0;bar.setAttribute('aria-label','选择整个'+(labels[b.type]||'元素')+'，可复制粘贴');
    const label = document.createElement('span'); label.className = 'block-label'; label.textContent = labels[b.type] || '内容'; bar.append(label);
    if (b.type === 'heading') {
      const select = document.createElement('select'); select.setAttribute('aria-label', '标题层级');
      for (const [level, title] of [[1,'页面标题'],[2,'章节标题'],[3,'分组标题'],[4,'细节标题']]) select.add(new Option(title, level));
      select.value = b.meta?.level || 2; select.onchange = () => { record(); b.meta ||= {}; b.meta.level = Number(select.value); updateBlock(section, b); renderBlocks(); changed(); }; bar.append(select);
    }
    const controls = document.createElement('div'); controls.className = 'block-controls';
    for (const [label, title, action] of [['复制','复制整个元素',()=>copyElement(index)],['＋','在此后添加正文',()=>insert({type:'text',raw:'\n',html:'<p><br></p>'}, index+1)],['↑','上移内容块',()=>move(index,-1)],['↓','下移内容块',()=>move(index,1)],['×','移除内容块',()=>{ if (confirm('移除这一块内容？保存前可以用“撤销”恢复。')) { record(); state.page.blocks.splice(index,1); renderBlocks(); changed(); } }]]) {
      const button = document.createElement('button'); button.textContent = label; button.title = title; button.setAttribute('aria-label', title); button.onclick = action; controls.append(button);
    }
    bar.append(controls); section.append(bar);
    const content = document.createElement('div'); content.className = 'block-content';
    if(titledTypes.has(b.type)){
      const label=document.createElement('label');label.className='element-title-control';
      const text=document.createElement('span');text.textContent='元素标题';
      const input=document.createElement('input');input.className='element-title-input';input.value=b.title||'';input.placeholder=`为${labels[b.type]}添加标题（可选）`;input.setAttribute('aria-label',`${labels[b.type]}标题`);
      label.append(text,input);content.append(label);
    }
    if (['text','list','table','quote','heading'].includes(b.type)) {
      let html = b.html || '<p><br></p>';
      if (b.type === 'heading') {
        const div = document.createElement('div'); div.innerHTML = html; const h = div.querySelector('h1,h2,h3,h4');
        const text = h?.innerHTML.replace(/\s+\{#[^}]+\}\s*$/, '') || '';
        html = `<h${b.meta?.level || 2}>${text}</h${b.meta?.level || 2}>`;
      }
      const field=editable(html, b.type === 'heading' ? '输入标题…' : '输入正文…');
      field.querySelectorAll('table').forEach(decorateTable);
      field.addEventListener('pointerdown',e=>{const cell=e.target.closest('td,th');if(cell)tableCell=cell;});
      content.append(field);
    } else if (b.type === 'callout') {
      const head = document.createElement('div'); head.className = 'callout-controls';
      const kind = document.createElement('select'); kind.className = 'callout-kind'; kind.setAttribute('aria-label','提示类型'); for (const [v,t] of [['info','说明'],['tip','要点'],['warning','注意'],['danger','重要提醒']]) kind.add(new Option(t,v)); kind.value = b.meta?.kind || 'info';
      const title = document.createElement('input'); title.className = 'callout-title'; title.placeholder = '提示框标题'; title.value = b.meta?.title || '';
      head.append(kind,title); content.append(head);
      const d = document.createElement('div'); d.innerHTML = b.html; const callout = d.querySelector('.custom-block'); callout?.querySelector('.custom-block-title')?.remove();
      content.append(editable(callout?.innerHTML || '<p><br></p>','输入提示说明…'));
    } else if (b.type==='tactics') {
      content.innerHTML=sanitize(b.html||b.raw);mountTactics(content,{assetBase:'/media'});
      const edit=document.createElement('button');edit.type='button';edit.className='tactics-edit-button';edit.textContent='编辑战术板';edit.onclick=()=>tacticsWorkbench.open(b.meta.src,result=>{if(result.src===b.meta.src)return;record();Object.assign(b,tacticsBlock(result.src));renderBlocks();changed();});content.append(edit);
    } else if (['image','video','gallery'].includes(b.type)) {
      const items = mediaParts(b); const grid = document.createElement('div'); grid.className = 'editor-media' + (b.type === 'gallery' ? ' gallery' : '');
      if (!items.length) { b.type = 'raw'; content.innerHTML = '<p class="preserved-label">此媒体组合已原样保留，可在其前后继续添加内容。</p>' + sanitize(b.html); }
      else {
        items.forEach((item, i) => {
          const card = document.createElement('div'); card.className = 'media-card';
          if (item.kind === 'video') card.innerHTML = sanitize(item.original);
          else { const img = document.createElement('img'); img.src = localMedia(item.src); img.alt = item.alt; card.append(img); }
          const caption = document.createElement('input'); caption.className = 'media-caption'; caption.placeholder = '填写示范说明…'; caption.value = item.caption; caption.dataset.item = i; caption.setAttribute('aria-label', '媒体说明'); card.append(caption); grid.append(card);
        });
        content.append(grid);
        const replace = document.createElement('button'); replace.textContent = '替换 / 追加媒体'; replace.className = 'quiet'; replace.onclick = () => openMedia(b.type === 'gallery', index); content.append(replace);
        b.items = items;
      }
    } else if (b.type === 'divider') content.innerHTML = '<hr>';
    else {
      content.classList.add('preserved'); const hint = document.createElement('p'); hint.className = 'preserved-label'; hint.textContent = '已有特殊内容 · 原样保留'; content.append(hint);
      const view = document.createElement('div'); view.className = 'preserved-view'; view.innerHTML = sanitize(b.html || ''); content.append(view);
    }
    section.append(content);
    section.addEventListener('pointerdown',e=>{state.selected=index;target.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));section.classList.add('selected');if(!e.target.closest('input,select,button,[contenteditable],video,a'))bar.focus({preventScroll:true});});
    section.addEventListener('focusin', () => { state.selected = index; target.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')); section.classList.add('selected'); });
    section.addEventListener('input', e => {if(b.type==='tactics')return;record();if(e.target.classList.contains('element-title-input')){b.title=e.target.value;updateElementSource(b,b.contentRaw??b.raw);}else updateBlock(section,b);changed(); });
    section.addEventListener('keydown', e => { if (b.type === 'heading' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); insert({type:'text',raw:'\n',html:'<p><br></p>'},index+1); } });
    section.addEventListener('change', e => { if (e.target.classList.contains('callout-kind')) { record(); updateBlock(section,b); changed(); } });
    target.append(section);
  });
}
function updateBlock(section, b) {
  const field = section.querySelector('.rich-field');
  if (b.type === 'heading') {
    const div = document.createElement('div'); div.innerHTML = field.innerHTML; const h = div.querySelector('h1,h2,h3,h4');
    const text = htmlMarkdown(h ? Object.assign(document.createElement('div'), { innerHTML:h.innerHTML }) : div).replace(/\n+/g,' ');
    b.raw = '#'.repeat(b.meta.level) + ' ' + text + (b.meta.anchor ? ' ' + b.meta.anchor : '') + '\n'; b.html = `<h${b.meta.level}>${h?.innerHTML || div.innerHTML}</h${b.meta.level}>`;
  } else if (b.type === 'callout') {
    b.meta.kind = section.querySelector('.callout-kind').value; b.meta.title = section.querySelector('.callout-title').value.replace(/\n/g,' ');
    b.raw = `::: ${b.meta.kind} ${b.meta.title}\n${htmlMarkdown(field)}\n:::\n`;
    b.html = `<div class="${b.meta.kind} custom-block"><p class="custom-block-title">${escapeHTML(b.meta.title)}</p>${field.innerHTML}</div>`;
  } else if (['image','video','gallery'].includes(b.type)) {
    section.querySelectorAll('.media-caption').forEach(el => b.items[el.dataset.item].caption = el.value.replace(/\n/g,' '));
    const raw = b.items.map(item => item.original + (item.caption ? (b.type === 'gallery' ? '\n' : '\n\n') + item.caption : '')).join('\n\n');
    b.raw = b.type === 'gallery' ? `::: media-grid\n${raw}\n:::\n` : raw + '\n';
  } else if (field) { b.raw = htmlMarkdown(field) + '\n'; b.html = field.innerHTML; }
  if(titledTypes.has(b.type))updateElementSource(b,b.raw);
}
function move(index, direction) { const other = index + direction; if (other < 0 || other >= state.page.blocks.length) return; record(); [state.page.blocks[index],state.page.blocks[other]] = [state.page.blocks[other],state.page.blocks[index]]; for(const i of [index,other])if(i>0)state.page.blocks[i].prefix='\n\n'+(state.page.blocks[i].prefix||''); state.selected = other; renderBlocks(); changed(); }
function insert(block, position) {
  if (!state.page) { toast('先打开或新建一篇页面。'); return; }
  record(); block.prefix ??= '\n\n'; block.meta ||= {}; const i = position ?? (state.selected < 0 ? state.page.blocks.length : state.selected + 1); state.page.blocks.splice(i,0,block); state.selected = i; renderBlocks(); changed();
  const section = document.querySelector(`.editor-block[data-index="${i}"]`); section?.scrollIntoView({behavior:'smooth',block:'center'}); section?.querySelector('[contenteditable]')?.focus();if(block.type==='table'){tableCell=section.querySelector('th,td');focusCell(tableCell);}
}
let pendingBlockCopy=null;
async function copyElement(index=state.selected){
  const block=state.page?.blocks[index];if(!block)return toast('先选择要复制的元素。');
  try{
    const value=encodeBlock(block,state.project);
    if(window.floorballDesktop?.writeBlockClipboard)await window.floorballDesktop.writeBlockClipboard(value);
    else{
      pendingBlockCopy=value;
      try{if(!document.execCommand('copy'))await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([value.html],{type:'text/html'}),'text/plain':new Blob([value.text],{type:'text/plain'})})]);}finally{pendingBlockCopy=null;}
    }
    toast('元素已复制，可在其他页面粘贴。');
  }catch(error){toast('复制失败：'+error.message,true);}
}
function pasteCopiedHTML(html,context){
  const block=decodeBlock(html,state.project);if(!block)return false;
  if(state.page!==context.page)throw Error('页面已切换，请重新选择粘贴位置。');
  const index=context.after?state.page.blocks.indexOf(context.after):-1;
  if(context.after&&index<0)throw Error('粘贴位置已改变，请重新选择。');
  insert(block,context.after?index+1:state.page.blocks.length);return true;
}
function pasteContext(){return {page:state.page,after:state.page?.blocks[state.selected]};}
async function pasteElement(){
  if(!state.page)return toast('先打开要粘贴到的页面。');
  const context=pasteContext();
  try{
    let html='';
    if(window.floorballDesktop?.readBlockClipboard)html=await window.floorballDesktop.readBlockClipboard();
    else for(const item of await navigator.clipboard.read())if(item.types.includes('text/html')){html=await (await item.getType('text/html')).text();break;}
    if(!pasteCopiedHTML(html,context))toast('剪贴板中没有元素，请先点击元素上的“复制”。');
  }catch(error){toast('粘贴失败：'+error.message+'；也可选中目标元素后按 Ctrl+V。',true);}
}
document.addEventListener('copy',e=>{let value=pendingBlockCopy;if(!value&&document.activeElement.closest('.block-bar')&&!document.activeElement.closest('input,select')&&state.page?.blocks[state.selected])try{value=encodeBlock(state.page.blocks[state.selected],state.project);}catch(error){toast(error.message,true);}if(!value)return;e.preventDefault();e.clipboardData.setData('text/html',value.html);e.clipboardData.setData('text/plain',value.text);});
document.addEventListener('paste',e=>{
  if(!state.page||document.querySelector('dialog[open]')||!e.target.closest('#blocks'))return;
  const html=e.clipboardData?.getData('text/html');if(!html?.includes('data-floorball-editor-block='))return;
  e.preventDefault();e.stopImmediatePropagation();try{pasteCopiedHTML(html,pasteContext());}catch(error){toast(error.message,true);}
},true);
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||!e.target.closest('.block-bar')||e.target.closest('input,select'))return;const key=e.key.toLowerCase();if(key==='c'||key==='v'){e.preventDefault();key==='c'?copyElement():pasteElement();}});
$('#copy-block').onclick=()=>copyElement();$('#paste-block').onclick=pasteElement;
function add(type) {
  if (!state.page) return toast('先打开或新建一篇页面。');
  if (type === 'heading') { $('#heading-text').value=''; $('#heading-dialog').showModal(); return; }
  if (['media','gallery'].includes(type)) return openMedia(type === 'gallery');
  if(type==='tactics')return tacticsWorkbench.open(null,result=>insert(tacticsBlock(result.src)));
  const templates = { text:{raw:'\n',html:'<p><br></p>'}, list:{raw:'- 新的要点\n',html:'<ul><li>新的要点</li></ul>'}, table:{raw:'|  |  |\n| --- | --- |\n|  |  |\n',html:'<table><thead><tr><th scope="col"><br></th><th scope="col"><br></th></tr></thead><tbody><tr><th scope="row"><br></th><td><br></td></tr></tbody></table>'}, callout:{raw:'::: tip 训练要点\n填写说明\n:::\n',meta:{kind:'tip',title:'训练要点'},html:'<div class="tip custom-block"><p class="custom-block-title">训练要点</p><p>填写说明</p></div>'},divider:{raw:'---\n',html:'<hr>'} };
  insert({type,...templates[type]});
}
function showWarnings(warnings = []) { $('#warnings').replaceChildren(); for (const text of warnings) { const p = document.createElement('p'); p.textContent = '提示：' + text; $('#warnings').append(p); } }
async function updatePreview() {
  if (!state.page) return;
  const id = ++state.previewId;
  try { const data = await api('/api/render', { document:JSON.parse(contentJSON()),profile:state.page.profile,path:state.page.path }); if (id !== state.previewId) return; $('#preview').contentWindow.postMessage({type:'render',...data,dark:state.dark,navigation:previewNavigation},location.origin);previewNavigation=null; showWarnings(data.warnings); } catch (e) { toast('预览失败：'+e.message,true); }
}
async function save() {
  if (!state.page || busy) return; busy=true; $('#save').disabled=true; $('#save').textContent='保存中…';
  try {
    const snapshot=contentJSON();const requestedPath=state.page.path;
    const data = await api('/api/save',{path:requestedPath,version:state.page.version,document:JSON.parse(snapshot)});
    if(state.page?.path===requestedPath){
      if(contentJSON()===snapshot){const position=window.scrollY;adoptPage(data);window.scrollTo(0,position);}
      else{state.page.version=data.version;state.saved=snapshot;changed();}
    }
    await refreshTree(); toast(data.unchanged ? '页面没有改动。' : '已保存到本机，原文件已备份。');
    return true;
  } catch (e) { toast(e.message,true); return false; } finally {busy=false;$('#save').disabled=false;$('#save').textContent='保存页面';}
}
function selectedField() { return document.querySelector(`.editor-block[data-index="${state.selected}"] .rich-field`); }
function restoreSelection() { if (selection) { const s=getSelection();s.removeAllRanges();s.addRange(selection); } }
function command(cmd) {
  if (!selectedField()) return toast('请先点击正文、列表或表格里的文字。');
  restoreSelection();
  if (cmd === 'createLink') { openLinkPicker();return; }
  document.execCommand(cmd,false);
}
function tableAction(action) {
  const field=selectedField();const table=tableCell?.isConnected&&tableCell.closest('table');
  if(!field||!table||!field.contains(tableCell))return toast('请先点击要操作的单元格。');
  record();const next=changeTable(table,tableCell,action);$('#table-menu').open=false;
  if(!next){state.page.blocks.splice(state.selected,1);tableCell=null;renderBlocks();changed();toast('最后一行或一列已移除，表格已删除；可以撤销。');return;}
  tableCell=next;updateBlock(field.closest('.editor-block'),state.page.blocks[state.selected]);changed();focusCell(next);
}
function linkModeSet(mode){linkMode=mode;$('#link-internal').hidden=mode!=='page';$('#link-external').hidden=mode!=='external';$('#link-url').required=mode==='external';$('#link-mode-page').classList.toggle('active',mode==='page');$('#link-mode-external').classList.toggle('active',mode==='external');if(mode==='external'&&!linkTextManual)$('#link-text').value='';}
function openLinkPicker(anchor){
  if(anchor?.closest('.rich-field')){linkField=anchor.closest('.rich-field');state.selected=Number(linkField.closest('.editor-block').dataset.index);}else{linkField=selectedField();if(!linkField)return;restoreSelection();anchor=getSelection().anchorNode?.parentElement?.closest('a');}
  editingLink=anchor?.closest('.rich-field')===linkField?anchor:null;
  const s=getSelection();if(editingLink){const r=document.createRange();r.selectNodeContents(editingLink);s.removeAllRanges();s.addRange(r);}
  linkRange=s.rangeCount?s.getRangeAt(0).cloneRange():null;
  $('#link-text').value=s.toString();linkTextManual=!!s.toString();$('#link-url').value='';$('#link-search').value='';linkChoice=null;linkPage=state.page.path;
  hideLinkEditor();const existing=editingLink&&resolveLink(editingLink.getAttribute('href'),state.page.path,['index.md',...state.groups.flatMap(g=>g.pages.map(p=>p.path))],location.origin);
  $('#link-dialog').showModal();
  if(existing?.type==='external'){linkModeSet('external');$('#link-url').value=editingLink.getAttribute('href');drawLinkPages();}
  else{linkModeSet('page');drawLinkPages();chooseLinkPage(existing?.path||linkPage,existing?.hash);}
}
function drawLinkPages(){
  const nav=$('#link-pages');const scroll=nav.scrollTop;nav.replaceChildren();const query=$('#link-search').value.trim().toLowerCase();
  const groups=[{category:'网站',pages:[{path:'index.md',title:state.homeName}]},...state.groups];
  for(const group of groups){const nodes=group.children||group.pages.map(page=>({type:'page',page}));const categoryLabel=group.displayName||group.category;let sectionAdded=false;
    const addPage=(p,folder='')=>{if(!(group.category+' '+categoryLabel+' '+folder+' '+p.title).toLowerCase().includes(query))return;if(!sectionAdded){const label=document.createElement('strong');label.textContent=categoryLabel;nav.append(label);sectionAdded=true;}const b=document.createElement('button');b.type='button';b.textContent=p.title;b.title=categoryLabel+(folder?' / '+folder:'')+' / '+p.title;b.className='link-page'+(p.path===linkPage?' active':'');b.onclick=()=>chooseLinkPage(p.path);nav.append(b);};
    for(const node of nodes){if(node.type==='page')addPage(node.page);else{if(node.pages.some(p=>(group.category+' '+categoryLabel+' '+node.name+' '+p.title).toLowerCase().includes(query))){if(!sectionAdded){const label=document.createElement('strong');label.textContent=categoryLabel;nav.append(label);sectionAdded=true;}const label=document.createElement('small');label.className='link-folder-label';label.textContent=node.name;nav.append(label);}for(const p of node.pages)addPage(p,node.name);}}
  }
  if(!nav.children.length)nav.textContent='没有找到匹配页面。';nav.scrollTop=scroll;
}
async function chooseLinkPage(path,preferredId){
  showTargetText({});
  linkPage=path;linkChoice=null;drawLinkPages();const id=++linkRequest;const target=$('#link-targets');target.textContent='正在读取页面区块…';
  $('#link-target-search').value='';
  try{
    const data=path===state.page.path?await api('/api/targets',{path,document:JSON.parse(contentJSON())}):await api('/api/targets?path='+encodeURIComponent(path));
    if(id!==linkRequest)return;target.replaceChildren();
    let blockLabel=false;
    for(const item of data.targets){if(item.type==='block'&&!blockLabel){const label=document.createElement('strong');label.className='target-group';label.textContent='正文、表格与媒体区块';target.append(label);blockLabel=true;}const b=document.createElement('button');b.type='button';b.className='link-target';b.dataset.targetId=item.id;b.dataset.targetType=item.type||'heading';b.style.paddingLeft=(item.type==='block'?12:12+Math.max(0,item.level-1)*12)+'px';b.textContent=(item.type==='block'?'◈ ':item.level?'↳ ':'▤ ')+item.label;b.title=item.section||item.label;b.onclick=()=>{linkChoice={...item};showTargetText(item);target.querySelectorAll('.active').forEach(e=>e.classList.remove('active'));b.classList.add('active');$('#link-choice').textContent=path.replace(/\.md$/,'')+'  /  '+item.label;if(!linkTextManual)$('#link-text').value=item.level?item.label:state.groups.flatMap(g=>g.pages).find(p=>p.path===path)?.title||'首页';};target.append(b);}
    const chosen=[...target.querySelectorAll('.link-target')].find(b=>b.dataset.targetId===textTarget(preferredId).anchor)||target.querySelector('.link-target');chosen?.click();if(preferredId&&textTarget(preferredId).text){const passage=textTarget(preferredId);applyTextTarget(passage);}
  }catch(e){if(id===linkRequest){target.textContent='读取失败，请重新选择页面。';toast(e.message,true);}}
}
let targetPassage=null;
function showTargetText(item){
  targetPassage=null;$('#link-use-text').disabled=true;$('#link-selected-text').textContent='';
  $('#link-text-target').hidden=!item.previewHTML;
  $('#link-target-preview').innerHTML=sanitize(item.previewHTML||'');
  $('#link-target-preview').querySelectorAll('a').forEach(a=>a.removeAttribute('href'));
}
function applyTextTarget(passage){
  if(!linkChoice||!passage?.text)return;
  linkChoice.url=textTargetURL(linkChoice.url,passage.text,passage.prefix,passage.suffix);
  $('#link-selected-text').textContent='目标文字：'+passage.text;
  $('#link-choice').textContent=linkPage.replace(/\.md$/,'')+' / '+linkChoice.label+' / '+passage.text;
}
$('#link-target-preview').addEventListener('mouseup',()=>{
  const root=$('#link-target-preview'),selection=getSelection();targetPassage=null;
  if(selection.rangeCount){const range=selection.getRangeAt(0);if(root.contains(range.startContainer)&&root.contains(range.endContainer)&&selection.toString().trim()){
    const before=range.cloneRange();before.selectNodeContents(root);before.setEnd(range.startContainer,range.startOffset);
    const after=range.cloneRange();after.selectNodeContents(root);after.setStart(range.endContainer,range.endOffset);
    targetPassage={text:range.toString().trim(),prefix:[...before.toString()].slice(-40).join(''),suffix:[...after.toString()].slice(0,40).join('')};
  }}
  $('#link-use-text').disabled=!targetPassage;
});
$('#link-use-text').onclick=()=>applyTextTarget(targetPassage);
$('#link-reset-text').onclick=()=>{if(!linkChoice)return;linkChoice.url=linkChoice.url.split(':floorball-text=')[0];$('#link-selected-text').textContent='';$('#link-choice').textContent=linkPage.replace(/\.md$/,'')+' / '+linkChoice.label;};
function openMedia(asGallery, index = -1, position) { gallery=asGallery;editingMedia=index;mediaPosition=position??(state.selected<0?state.page.blocks.length:state.selected+1);mediaPagePath=state.page.path;queue=[];$('#media-files').value='';$('#media-queue').replaceChildren();$('#media-dialog-title').textContent=index>=0?'替换或追加示范媒体':asGallery?'添加并排媒体':'添加图片或视频';$('#media-dialog').showModal(); }
const videoFile=file=>/\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(file.name);
const sizeLabel=bytes=>bytes>=1024*1024?(bytes/1024/1024).toFixed(1)+' MB':Math.max(1,Math.round(bytes/1024))+' KB';
function addQueue(files) {
  if(mediaImporting)return;
  for(const file of files){const max=videoFile(file)?1024*1024*1024:256*1024*1024;if(file.size>max){toast(file.name+' 超过大小限制，请先截取需要的片段。',true);continue;}if(!/\.(png|jpe?g|gif|webp|avif|mp4|webm|mov|m4v|mkv|avi)$/i.test(file.name)){toast('不支持这个文件：'+file.name,true);continue;}queue.push({file,caption:''});}
  $('#media-queue').replaceChildren();queue.forEach((item,i)=>{const row=document.createElement('div');row.className='queue-row';const name=document.createElement('span');name.textContent=item.file.name+' · '+sizeLabel(item.file.size);const input=document.createElement('input');input.placeholder='这段视频 / 图片的说明';input.value=item.caption;input.oninput=()=>item.caption=input.value;const status=document.createElement('div');status.className='import-status';status.textContent=videoFile(item.file)?'导入时自动压缩，保留原文件':'等待导入';const progress=document.createElement('progress');progress.max=100;progress.value=0;progress.hidden=true;item.status=status;item.progress=progress;row.append(name,input,status,progress);$('#media-queue').append(row);});
}
async function importFile(item){
  if(item.result)return item.result;
  item.progress.hidden=false;item.status.textContent='正在上传到本机…';
  const data=await new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST','/api/import?name='+encodeURIComponent(item.file.name));xhr.setRequestHeader('X-Editor-Session',state.token);
    xhr.upload.onprogress=e=>{if(e.lengthComputable){const percent=Math.round(e.loaded/e.total*100);item.progress.value=percent;item.status.textContent='上传 '+percent+'%';}};
    xhr.onerror=()=>reject(new Error('连接中断，请确认本地编辑器仍在运行。'));
    xhr.onload=()=>{try{const r=JSON.parse(xhr.responseText);xhr.status>=200&&xhr.status<300?resolve(r):reject(new Error(r.error||'导入失败'));}catch{reject(new Error('导入响应异常，请重试。'));}};xhr.send(item.file);
  });
  let result=data;
  if(data.jobId){
    while(true){const job=await api('/api/import-status?id='+encodeURIComponent(data.jobId));item.progress.value=job.progress;item.status.textContent=job.message+(job.status==='processing'?' · '+job.progress+'%':'');if(job.status==='error')throw new Error(job.error);if(job.status==='done'){result=job.result;break;}await new Promise(r=>setTimeout(r,350));}
  }
  item.progress.value=100;
  item.status.textContent=result.kind==='video'?`${result.reused?'复用已压缩视频':'压缩完成'}：${sizeLabel(result.originalBytes)} → ${sizeLabel(result.outputBytes)}${result.savedPercent>0?'，节省 '+result.savedPercent+'%':'（已优化网页播放）'}`:'图片已导入';
  item.result=result;return result;
}
async function mediaSubmit(e) {
  e.preventDefault();if(!queue.length)return toast('请先选择媒体文件。');if(mediaImporting)return;const button=$('#media-confirm');button.disabled=true;button.textContent='正在导入 / 压缩…';mediaImporting=true;
  $('#media-dialog').querySelectorAll('[data-close]').forEach(b=>b.disabled=true);$('#media-files').disabled=true;
  try {
    const items=[];
    for(const item of queue){const data=await importFile(item);const src=encodeURI(data.src);const original=data.kind==='video'?`<video src="${src}" controls playsinline preload="metadata"></video>`:`![${item.caption.replace(/[\[\]\n]/g,' ')}](${src})`;items.push({...data,src,original,caption:item.caption});}
    if(state.page?.path!==mediaPagePath)throw new Error('当前页面已切换，媒体已保留，请在目标页面重新插入。');
    let all=items;
    if(editingMedia>=0){const old=state.page.blocks[editingMedia];if(gallery){all=[...mediaParts(old),...items];}else if(!confirm('使用新选择的媒体替换当前媒体？原文件仍保留。'))return;}
    const grouped=gallery||all.length>1;const raw=all.map(x=>x.original+(x.caption?(grouped?'\n':'\n\n')+x.caption:'')).join('\n\n');
    const b={type:gallery?'gallery':all.length>1?'gallery':items[0].kind,items:all,raw:(gallery||all.length>1)?`::: media-grid\n${raw}\n:::\n`:raw+'\n',meta:{},html:''};
    if(editingMedia>=0){record();b.prefix=state.page.blocks[editingMedia].prefix;b.title=state.page.blocks[editingMedia].title||'';if(b.title)updateElementSource(b,b.raw);state.page.blocks[editingMedia]=b;renderBlocks();changed();}else insert(b,mediaPosition);
    $('#media-dialog').close();const videos=items.filter(x=>x.kind==='video');const before=videos.reduce((n,x)=>n+x.originalBytes,0),after=videos.reduce((n,x)=>n+x.outputBytes,0);toast(videos.length?`视频已处理：${sizeLabel(before)} → ${sizeLabel(after)}${after<before?'，节省 '+Math.round((1-after/before)*100)+'%':''}。原文件保留，保存页面后生效。`:'媒体已导入，保存页面后生效。');
  }catch(e){toast(e.message,true);}finally{mediaImporting=false;button.disabled=false;button.textContent='插入到页面';$('#media-files').disabled=false;$('#media-dialog').querySelectorAll('[data-close]').forEach(b=>b.disabled=false);}
}
const containsFiles=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
document.addEventListener('dragover',e=>{if(!containsFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';if(state.page&&e.target.closest('.editing-column')&&!document.querySelector('dialog[open]'))$('#blocks').classList.add('file-dragover');});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)$('#blocks').classList.remove('file-dragover');});
document.addEventListener('drop',e=>{if(!containsFiles(e))return;e.preventDefault();$('#blocks').classList.remove('file-dragover');if(e.target.closest('dialog'))return;if(!state.page)return toast('先打开或新建一篇页面，再拖入文件。');if(!e.target.closest('.editing-column'))return toast('请把视频拖到中间的内容编辑区。');const block=e.target.closest('.editor-block');const position=block?Number(block.dataset.index)+1:state.page.blocks.length;openMedia(e.dataTransfer.files.length>1,-1,position);addQueue(e.dataTransfer.files);});
$('#media-dialog').addEventListener('cancel',e=>{if(mediaImporting)e.preventDefault();});
$('#new-page').onclick=$('#welcome-create').onclick=()=>openNewPage();
$('#new-form').onsubmit=async e=>{e.preventDefault();if(state.dirty&&!confirm('当前页面有未保存内容，仍然新建页面吗？草稿会保留。'))return;const b=e.submitter||e.currentTarget.querySelector('[type=submit]');b.disabled=true;try{const page=await api('/api/create',{category:$('#new-category').value,title:$('#new-title').value,group:$('#new-group').value,groupsVersion:state.groupsVersion});$('#new-dialog').close();adoptPage(page);await refreshTree();toast('页面已创建，并加入目录。');}catch(e){toast(e.message,true);await refreshTree();}finally{b.disabled=false;}};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#search').oninput=drawTree;
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>add(b.dataset.add));
document.querySelectorAll('[data-command]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>command(b.dataset.command);});
document.querySelectorAll('[data-table]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>tableAction(b.dataset.table);});
document.addEventListener('selectionchange',()=>{const s=getSelection();const anchor=s.anchorNode?.nodeType===Node.ELEMENT_NODE?s.anchorNode:s.anchorNode?.parentElement;if(s.rangeCount&&anchor?.closest('.rich-field')){selection=s.getRangeAt(0).cloneRange();const cell=anchor.closest('td,th');if(cell)tableCell=cell;}});
$('#link-mode-page').onclick=()=>linkModeSet('page');$('#link-mode-external').onclick=()=>linkModeSet('external');$('#link-search').oninput=drawLinkPages;$('#link-text').oninput=()=>linkTextManual=!!$('#link-text').value.trim();
$('#link-target-search').oninput=()=>{const q=$('#link-target-search').value.trim().toLowerCase();$('#link-targets').querySelectorAll('.link-target').forEach(b=>b.hidden=!(b.textContent+' '+b.title).toLowerCase().includes(q));const label=$('#link-targets .target-group');if(label)label.hidden=!$('#link-targets .link-target[data-target-type=block]:not([hidden])');};
$('#link-form').onsubmit=async e=>{e.preventDefault();const url=safeURL(linkMode==='page'?linkChoice?.url:$('#link-url').value);if(!url)return toast(linkMode==='page'?'请选择页面或区块。':'请输入有效的链接地址。',true);if(!linkField?.isConnected||!linkRange)return toast('原来的编辑位置已变化，请重新选中文字。',true);const button=$('#link-confirm');button.disabled=true;try{
  if(linkMode==='page'&&linkChoice.type==='block'&&!linkChoice.existing){
    if(linkPage===state.page.path){record();const b=state.page.blocks[linkChoice.blockIndex];b.prefix=(b.prefix||'\n\n')+`<div id="${linkChoice.id}"></div>\n\n`;changed();}
    else await api('/api/ensure-anchor',{path:linkPage,version:linkChoice.version,blockIndex:linkChoice.blockIndex,id:linkChoice.id});
  }
  $('#link-dialog').close();const s=getSelection();s.removeAllRanges();s.addRange(linkRange);const text=$('#link-text').value.trim()||(linkMode==='page'?linkChoice?.label:'')||url;
  if(editingLink?.isConnected){record();editingLink.setAttribute('href',url);if(editingLink.textContent!==text)editingLink.textContent=text;updateBlock(linkField.closest('.editor-block'),state.page.blocks[Number(linkField.closest('.editor-block').dataset.index)]);changed();editingLink=null;}
  else if(!linkRange.collapsed&&text===s.toString())document.execCommand('createLink',false,url);else document.execCommand('insertHTML',false,`<a href="${escapeHTML(url)}">${escapeHTML(text)}</a>`);
}catch(error){toast(error.message,true);}finally{button.disabled=false;}};
$('#return-source').onclick=returnToSource;
$('#blocks').addEventListener('click',e=>{
  const a=e.target.closest('a[href]');if(!a)return;e.preventDefault();
  if(e.altKey){openLinkPicker(a);return;}
  const s=getSelection();if(s&&!s.isCollapsed&&a.closest('.rich-field')?.contains(s.anchorNode))return;
  navigateLink(a.getAttribute('href'));
});
$('#blocks').addEventListener('mouseover',e=>{const a=e.target.closest('a[href]');if(a)showLinkEditor(a);});
$('#link-edit-popover').addEventListener('mousedown',e=>e.preventDefault());
$('#edit-existing-link').onclick=()=>openLinkPicker($('#link-edit-popover')._anchor);
$('#unlink-existing').onclick=()=>{const a=$('#link-edit-popover')._anchor;if(!a?.isConnected)return;const field=a.closest('.rich-field');if(!field)return;record();a.replaceWith(...a.childNodes);updateBlock(field.closest('.editor-block'),state.page.blocks[Number(field.closest('.editor-block').dataset.index)]);changed();hideLinkEditor();};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('a,#link-edit-popover'))hideLinkEditor();});
window.addEventListener('scroll',hideLinkEditor,{passive:true});
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('#preview').contentWindow&&e.data?.type==='follow-link'&&typeof e.data.href==='string')navigateLink(e.data.href);});
$('#heading-form').onsubmit=e=>{e.preventDefault();const level=Number($('#heading-level').value),text=$('#heading-text').value.trim();insert({type:'heading',meta:{level},raw:'#'.repeat(level)+' '+text+'\n',html:`<h${level}>${escapeHTML(text)}</h${level}>`});$('#heading-dialog').close();};
$('#media-files').onchange=e=>addQueue(e.target.files);$('#media-form').onsubmit=mediaSubmit;
$('#dropzone').ondragover=e=>{e.preventDefault();$('#dropzone').classList.add('dragover');};$('#dropzone').ondragleave=()=>$('#dropzone').classList.remove('dragover');$('#dropzone').ondrop=e=>{e.preventDefault();$('#dropzone').classList.remove('dragover');addQueue(e.dataTransfer.files);};
$('#save').onclick=save;$('#undo').onclick=()=>undo();$('#redo').onclick=()=>undo(true);
$('#site-preview').onclick=async()=>{if(!state.page)return toast('先选择一篇页面。');if(state.dirty){if(!confirm('网站预览显示已保存的内容。现在保存并预览吗？'))return;if(!await save())return;}if(window.floorballDesktop){busy=true;reportDesktopState();try{await window.floorballDesktop.openPreview(state.page.path);}catch(error){toast(error.message,true);}finally{busy=false;reportDesktopState();}return;}const tab=window.open('about:blank','floorball-site-preview');try{toast('正在打开网站预览…');const data=await api('/api/preview',{path:state.page.path});if(tab)tab.location=data.url;else toast('浏览器阻止了新窗口，请允许弹出窗口后重试。',true);}catch(e){tab?.close();toast(e.message,true);}};
$('#preview').onload=updatePreview;$('#preview-width').onchange=()=>{$('#preview').classList.toggle('mobile', $('#preview-width').value==='mobile');};$('#theme-toggle').onclick=()=>{state.dark=!state.dark;$('#theme-toggle').textContent=state.dark?'浅色':'深色';updatePreview();};
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==='s'){e.preventDefault();save();}if(e.key.toLowerCase()==='z'&&!document.querySelector('dialog[open]')){e.preventDefault();undo(e.shiftKey);}if(e.key.toLowerCase()==='y'){e.preventDefault();undo(true);}}});
window.addEventListener('beforeunload',e=>{if(state.dirty||tacticsWorkbench.dirty||tacticsWorkbench.exporting){e.preventDefault();e.returnValue='';}});
function reportDesktopState(){if(!window.floorballDesktop)return;const value={dirty:state.dirty||tacticsWorkbench.dirty,busy:!!(busy||mediaImporting||tacticsWorkbench.exporting||tacticsWorkbench.saving),canSave:!!state.page&&!tacticsWorkbench.dirty};for(const [key,flag] of Object.entries(value))document.documentElement.dataset['desktop'+key[0].toUpperCase()+key.slice(1)]=String(flag);window.floorballDesktop.reportState(value);}
if(window.floorballDesktop){window.addEventListener('floorball-desktop-status',reportDesktopState);window.floorballDesktop.onSaveRequest(async()=>{if(tacticsWorkbench.dirty){toast('请先保存战术板中的修改。',true);return false;}return await save();});setInterval(reportDesktopState,250);reportDesktopState();}
try {const session=await api('/api/session');state.token=session.token;state.project=session.root;for(const category of session.categories){$('#new-category').add(new Option(category,category));$('#group-category').add(new Option(category,category));}await refreshTree();$('#save').disabled=true;$('#undo').disabled=true;$('#redo').disabled=true;if(window.floorballDesktop){const last=localStorage.getItem('floorball-desktop-last-page');if(last&&(last==='index.md'||state.groups.some(group=>group.pages.some(page=>page.path===last))))await loadPage(last,true);}}
catch(e){toast('无法连接本地编辑服务：'+e.message,true);}
// For navigation and page switching; no automatic file write occurs on open.
document.addEventListener('focusin',()=>{if(state.page&&!busy)$('#save').disabled=false;});
