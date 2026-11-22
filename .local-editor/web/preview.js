import { sanitize } from './serialize.js';
import { textTarget,followTextTarget } from './text-target.js';
import { mountTactics } from '/tactics-runtime/player.js';
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'render') return;
  document.documentElement.classList.toggle('dark', !!event.data.dark);
  document.querySelector('#page').className = event.data.profile;
  document.querySelector('.vp-doc').innerHTML = sanitize(event.data.html);
  mountTactics(document.querySelector('.vp-doc'),{assetBase:'/media'});
  requestAnimationFrame(()=>{
    const nav=event.data.navigation;
    if(nav?.hash){document.getElementById(textTarget(nav.hash).anchor)?.scrollIntoView({block:'start',behavior:'instant'});followTextTarget(document.querySelector('.vp-doc'),nav.hash);}
    else if(Number.isFinite(nav?.y))window.scrollTo(0,nav.y);
  });
});
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a)return;e.preventDefault();parent.postMessage({type:'follow-link',href:a.getAttribute('href')},location.origin);});
