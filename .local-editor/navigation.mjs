export function firstNavigationLink(items=[]){
  for(const item of items){if(typeof item.link==='string'&&item.link.startsWith('/'))return item.link;const nested=firstNavigationLink(item.items);if(nested)return nested;}
}
function menuItem(item){return item.items?{text:item.text,items:item.items.map(menuItem)}:{text:item.text,link:item.link};}
export function syncNavigation(items,sidebar){
  return items.map(item=>{
    if(!item.items)return {...item};
    const link=firstNavigationLink(item.items),category=link?.split('/')[1],pages=category&&sidebar[`/${category}/`];
    return pages?{...item,items:pages.map(menuItem)}:{...item};
  });
}
