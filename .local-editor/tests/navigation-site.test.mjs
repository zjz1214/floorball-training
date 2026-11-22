import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncNavigation,firstNavigationLink} from '../navigation.mjs';
test('two-level top menus share sidebar roots without expanding third-level pages',()=>{
 const nav=[{text:'首页',link:'/'},{text:'校队训练记录',items:[{text:'旧页面',link:'/校队训练记录/旧页面'}]},{text:'其他',link:'/其他/'}];
 const sidebar={'/校队训练记录/':[{text:'26秋',link:'/校队训练记录/26秋'},{text:'26春',collapsed:true,items:[{text:'总纲',link:'/校队训练记录/总纲'}]}]};const before=JSON.stringify({nav,sidebar});
 const result=syncNavigation(nav,sidebar);assert.equal(result[1].items[0].link,'/校队训练记录/26秋');assert.equal(result[1].items[1].text,'26春');assert.equal(result[1].items[1].link,'/校队训练记录/总纲');assert.equal('items' in result[1].items[1],false);assert.equal('collapsed' in result[1].items[1],false);assert.deepEqual(result[2],nav[2]);assert.equal(JSON.stringify({nav,sidebar}),before);
});
test('empty groups remain usable links to their category overview',()=>{
 const result=syncNavigation([{text:'校队训练记录',items:[{text:'总纲',link:'/校队训练记录/总纲'}]}],{'/校队训练记录/':[{text:'新学期',items:[]}]});assert.deepEqual(result[0].items,[{text:'新学期',link:'/校队训练记录/'}]);
});
test('overflow finds the category even when all pages are nested',()=>{
 const link=firstNavigationLink([{text:'26春',items:[{text:'总纲',link:'/校队训练记录/总纲'}]}]);assert.equal(link.slice(0,link.lastIndexOf('/')+1),'/校队训练记录/');assert.equal(firstNavigationLink([]),undefined);
});

test('category order reaches top/mobile navigation while home stays fixed and new categories append',()=>{
 const nav=[{text:'首页',link:'/'},{text:'基础',items:[{text:'概述',link:'/个人技术基础/'}]},{text:'装备',items:[{text:'概述',link:'/装备器材/'}]},{text:'其他',link:'/其他/'}];
 const sidebar={'/个人技术基础/':[{text:'控球',link:'/个人技术基础/控球训练'}],'/装备器材/':[{text:'球杆',link:'/装备器材/球杆选择'}]};
 const before=JSON.stringify({nav,sidebar});const result=syncNavigation(nav,sidebar,['装备器材','个人技术基础']);
 assert.deepEqual(result.map(item=>item.text),['首页','装备','基础','其他']);assert.equal(result[1].items[0].link,'/装备器材/球杆选择');assert.ok(!result.some(item=>item.text==='更多'));assert.equal(JSON.stringify({nav,sidebar}),before);
});
