export function pageRoute(name){return '/floorball-training/'+(name==='index.md'?'':name.replace(/index\.md$/,'').replace(/\.md$/,'').split('/').map(encodeURIComponent).join('/'));}
export function resolveLink(href,current,pages,origin){
  let url;try{url=new URL(href,origin+pageRoute(current));}catch{return null;}
  if(!['http:','https:','mailto:'].includes(url.protocol))return null;
  const allowed=[new URL(origin).host,'127.0.0.1:5173','zjz1214.github.io'];
  if(allowed.includes(url.host)){
    let pathname;try{pathname=decodeURIComponent(url.pathname).replace(/^(?:\/floorball-training)+(?=\/|$)/,'');}catch{return null;}
    const clean=pathname.replace(/^\//,'').replace(/\.(html|md)$/,'').replace(/\/$/,'');
    const target=pages.find(name=>name.replace(/(?:^|\/)index\.md$/,'').replace(/\.md$/,'')===clean);
    if(target){let hash;try{hash=decodeURIComponent(url.hash.slice(1));}catch{hash=url.hash.slice(1);}return {type:'page',path:target,hash};}
    if(url.host===new URL(origin).host&&/\.(mp4|webm|png|jpe?g|gif|svg|webp|avif|pdf)$/i.test(pathname))return {type:'external',href:origin+'/media/'+pathname.replace(/^\//,'')+url.hash};
  }
  return {type:'external',href:url.href};
}
