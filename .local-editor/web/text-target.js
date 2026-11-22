export function textTarget(hash){
  const [anchor,directive='']=String(hash||'').split(':floorball-text=');
  const parts=directive.split('&')[0].split(',');let prefix='',suffix='';
  if(parts.length>1&&parts[0].endsWith('-'))prefix=parts.shift().slice(0,-1);
  if(parts.length>1&&parts.at(-1).startsWith('-'))suffix=parts.pop().slice(1);
  const decode=value=>{try{return decodeURIComponent(value);}catch{return value;}};
  return {anchor:decode(anchor),text:decode(parts[0]),prefix:decode(prefix),suffix:decode(suffix)};
}
export function textTargetURL(url,text,prefix='',suffix=''){
  const encode=value=>encodeURIComponent(value).replace(/-/g,'%2D');
  return String(url).split(':floorball-text=')[0]+':floorball-text='+(prefix?encode(prefix)+'-,':'')+encode(text.trim())+(suffix?',-'+encode(suffix):'');
}
export function textRange(root,text,prefix='',suffix=''){
  if(!root||!text)return null;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const points=[];let value='',node;
  while((node=walker.nextNode())){
    if(node.parentElement?.closest('script,style,button,input,select,.block-bar,.element-title-control'))continue;
    for(let i=0;i<node.data.length;i++){
      const char=/\s|\u00a0/.test(node.data[i])?' ':node.data[i];
      if(char===' '&&value.endsWith(' '))continue;
      value+=char;points.push({node,offset:i});
    }
  }
  const needle=text.replace(/\s|\u00a0/g,' ').replace(/ +/g,' ').trim();if(!needle)return null;
  const normalize=value=>value.replace(/\s|\u00a0/g,' ').replace(/ +/g,' ').trim();
  let index=value.indexOf(needle);
  while(index>=0&&((prefix&&!value.slice(0,index).trimEnd().endsWith(normalize(prefix)))||(suffix&&!value.slice(index+needle.length).trimStart().startsWith(normalize(suffix)))))index=value.indexOf(needle,index+1);
  if(index<0)return null;
  const start=points[index],end=points[index+needle.length-1],range=document.createRange();
  range.setStart(start.node,start.offset);range.setEnd(end.node,end.offset+1);return range;
}
export function highlightText(root,selector){
  globalThis.CSS?.highlights?.delete('floorball-link-text');
  const {text,prefix,suffix}=typeof selector==='string'?{text:selector}:selector;
  const range=textRange(root,text,prefix,suffix);if(!range)return false;
  if(globalThis.Highlight&&globalThis.CSS?.highlights)CSS.highlights.set('floorball-link-text',new Highlight(range));
  const element=range.startContainer.parentElement;element?.scrollIntoView({block:'center',behavior:'instant'});return true;
}
export function followTextTarget(scope,hash){
  const target=textTarget(hash),anchor=document.getElementById(target.anchor);
  if(!target.text||!scope)return false;
  const root=anchor&&scope.contains(anchor)?(anchor.id.startsWith('editor-block-')?anchor.nextElementSibling:anchor):scope;
  if(anchor&&scope.contains(anchor))anchor.scrollIntoView({block:'start',behavior:'instant'});
  return highlightText(root,target);
}
