import {sidebarPage} from './order.mjs';
import MarkdownIt from 'markdown-it';
import {firstNavigationLink} from './navigation.mjs';
const markdown=new MarkdownIt({html:true});
export function pageTitle(source,fallback=''){
  const body=source.replace(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'');
  const tokens=markdown.parse(body,{}),index=tokens.findIndex(token=>token.type==='heading_open'&&token.tag==='h1');
  if(index<0)return fallback;
  return markdown.utils.unescapeAll(markdown.renderInline(tokens[index+1].content.replace(/\s*\{#[^}]+\}\s*$/,'' )).replace(/<[^>]*>/g,'')).trim()||fallback;
}
export function applyNavigationNames(nodes,names={},depth=0,titles={}){
  return nodes.map(node=>{
    const result={...node};const groups=names.categories||{};const pages=names.pages||{};
    if(node.items)result.items=applyNavigationNames(node.items,names,depth+1,titles);
    let page,category;try{if(node.link?.startsWith('/')){page=sidebarPage(node.link);category=decodeURIComponent(node.link.split('/')[1]);}}catch{}
    if(page&&(titles[page]||pages[page]))result.text=titles[page]||pages[page];
    if(depth===0&&groups[node.text])result.text=groups[node.text];
    else if(depth===0&&category&&groups[category]&&node.link===`/${category}/`)result.text=groups[category];
    if(depth===0){const root=firstNavigationLink([node])?.split('/')[1];if(root&&titles[`${root}/index.md`])result.text=titles[`${root}/index.md`];}
    return result;
  });
}
