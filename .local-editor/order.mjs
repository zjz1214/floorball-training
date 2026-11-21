export function sortByOrder(items,order=[],key=item=>item.path){
  const ranks=new Map(order.map((value,index)=>[value,index]));
  return items.map((item,index)=>({item,index,rank:ranks.get(key(item))??Infinity})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(row=>row.item);
}
export function sidebarPage(link){
  const clean=decodeURIComponent(link.split('#')[0]).replace(/^\//,'');
  if(!clean)return 'index.md';
  return clean.endsWith('/')?clean+'index.md':clean.replace(/\.html$/,'')+'.md';
}
