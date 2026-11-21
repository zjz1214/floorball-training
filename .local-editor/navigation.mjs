export function firstNavigationLink(items=[]){
  for(const item of items){if(typeof item.link==='string'&&item.link.startsWith('/'))return item.link;const nested=firstNavigationLink(item.items);if(nested)return nested;}
}
function menuItem(item,overview){return {text:item.text,link:item.items?(firstNavigationLink(item.items)||overview):item.link};}
export function syncNavigation(items,sidebar){
  return items.map(item=>{
    if(!item.items)return {...item};
    const link=firstNavigationLink(item.items),category=link?.split('/')[1],pages=category&&sidebar[`/${category}/`];
    return pages?{...item,items:pages.map(page=>menuItem(page,`/${category}/`))}:{...item};
  });
}
