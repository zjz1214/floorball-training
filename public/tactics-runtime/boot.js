import {observeTactics} from './player.js';
// A public ES module entry works in dev and under the deployed VitePress base.
const assetBase=new URL('../',import.meta.url).pathname.replace(/\/$/,'');
observeTactics(document,{assetBase});
