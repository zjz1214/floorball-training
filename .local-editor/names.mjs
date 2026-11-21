import {sidebarPage} from './order.mjs';
export function applyNavigationNames(nodes,names={},depth=0){
  return nodes.map(node=>{
    const result={...node};const groups=names.categories||{};const pages=names.pages||{};
    if(node.items)result.items=applyNavigationNames(node.items,names,depth+1);
    let page,category;try{if(node.link?.startsWith('/')){page=sidebarPage(node.link);category=decodeURIComponent(node.link.split('/')[1]);}}catch{}
    if(page&&pages[page])result.text=pages[page];
    if(depth===0&&groups[node.text])result.text=groups[node.text];
    else if(depth===0&&category&&groups[category]&&node.link===`/${category}/`)result.text=groups[category];
    return result;
  });
}
