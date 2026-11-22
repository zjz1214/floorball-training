const types=new Set(['text','list','table','quote','heading','callout','image','video','gallery','tactics','divider','raw']);
export const blockClipboardAttribute='data-floorball-editor-block';
const limit=4*1024*1024;
export function copyableBlock(block){
  if(!block||!types.has(block.type)||typeof block.raw!=='string'||block.raw.length>limit)throw Error('无法复制这个元素。');
  // Carry only the element itself, never preceding layout or persistent link targets.
  const result={type:block.type,raw:block.raw,prefix:'\n\n'};
  for(const key of ['meta','title','contentRaw','html','items'])if(block[key]!==undefined)result[key]=structuredClone(block[key]);
  if(result.type==='heading'){
    result.raw=result.raw.replace(/\s+\{#[^}\r\n]+\}(?=\s*$)/,'');
    if(result.meta)delete result.meta.anchor;
    if(result.html)result.html=result.html.replace(/\s+id=(?:"[^"]*"|'[^']*')/g,'');
  }
  return result;
}
export function encodeBlock(block,project){
  const payload=encodeURIComponent(JSON.stringify({version:1,project,block:copyableBlock(block)}));
  if(payload.length>limit)throw Error('元素过大，暂时无法复制。');
  const text=block.raw;
  const escaped=text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return {html:`<div ${blockClipboardAttribute}="${payload}"><pre>${escaped}</pre></div>`,text};
}
export function decodeBlock(html,project){
  if(typeof html!=='string'||html.length>limit*2)return null;
  const match=html.match(/\bdata-floorball-editor-block="([^"]+)"/);
  if(!match)return null;
  let data;try{data=JSON.parse(decodeURIComponent(match[1]));}catch{throw Error('剪贴板中的元素格式无效。');}
  if(data.version!==1||typeof data.project!=='string')throw Error('剪贴板中的元素格式无效。');
  if(data.project!==project)throw Error('请在同一个项目内粘贴元素，跨项目媒体请重新导入。');
  return copyableBlock(data.block);
}
