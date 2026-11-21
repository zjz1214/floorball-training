import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncNavigation,firstNavigationLink} from '../navigation.mjs';
test('top menus share new pages, labels, ordering and groups with the sidebar',()=>{
 const nav=[{text:'首页',link:'/'},{text:'校队训练记录',items:[{text:'旧页面',link:'/校队训练记录/旧页面'}]},{text:'其他',link:'/其他/'}];
 const sidebar={'/校队训练记录/':[{text:'26秋',link:'/校队训练记录/26秋'},{text:'26春',collapsed:true,items:[{text:'总纲',link:'/校队训练记录/总纲'}]}]};const before=JSON.stringify({nav,sidebar});
 const result=syncNavigation(nav,sidebar);assert.equal(result[1].items[0].link,'/校队训练记录/26秋');assert.equal(result[1].items[1].text,'26春');assert.deepEqual(result[1].items[1].items,sidebar['/校队训练记录/'][1].items);assert.equal('collapsed' in result[1].items[1],false);assert.deepEqual(result[2],nav[2]);assert.equal(JSON.stringify({nav,sidebar}),before);
});
test('overflow finds the category even when all pages are nested',()=>{
 const link=firstNavigationLink([{text:'26春',items:[{text:'总纲',link:'/校队训练记录/总纲'}]}]);assert.equal(link.slice(0,link.lastIndexOf('/')+1),'/校队训练记录/');assert.equal(firstNavigationLink([]),undefined);
});
