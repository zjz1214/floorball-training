export const titledTypes=new Set(['table','video','image','gallery']);
export function updateElementSource(block,body){
  block.contentRaw=body;
  const title=String(block.title||'').replace(/[\r\n]+/g,' ').trim();
  const fence=':'.repeat(Math.max(4,...[...body.matchAll(/^\s*(:{3,})/gm)].map(m=>m[1].length+1)));
  block.raw=title?`${fence} element ${title}\n\n${body.trim()}\n\n${fence}\n`:body;
}
