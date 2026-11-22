import test from 'node:test';
import assert from 'node:assert/strict';
import {applyNavigationNames,pageTitle} from '../names.mjs';
test('navigation labels change without changing links or mutating source data',()=>{
 const input=[{text:'首页',link:'/'},{text:'训练计划',items:[{text:'概述',link:'/训练计划/'},{text:'传球与接球',link:'/训练计划/传球与接球'}]},{text:'其他',link:'/其他/'}];
 const names={pages:{'index.md':'网站主页','训练计划/传球与接球.md':'传接球课'},categories:{'训练计划':'课程安排','其他':'参考资料'}};
 const result=applyNavigationNames(input,names);assert.equal(result[0].text,'网站主页');assert.equal(result[1].text,'课程安排');assert.equal(result[1].items[1].text,'传接球课');assert.equal(result[1].items[1].link,input[1].items[1].link);assert.equal(result[2].text,'参考资料');assert.equal(input[1].text,'训练计划');
});

test('saved H1 labels override aliases for categories and pages without changing routes or group labels',()=>{
 const nodes=[{text:'旧栏目',items:[{text:'概述',link:'/课程/'},{text:'旧名字',link:'/课程/练习'},{text:'26春',items:[{text:'旧名字',link:'/课程/练习'}]}]}];
 const result=applyNavigationNames(nodes,{categories:{'旧栏目':'旧别名'},pages:{'课程/练习.md':'页面别名'}},0,{'课程/index.md':'课程主标题','课程/练习.md':'控运球训练'});
 assert.equal(result[0].text,'课程主标题');assert.equal(result[0].items[0].text,'课程主标题');assert.equal(result[0].items[1].text,'控运球训练');assert.equal(result[0].items[2].text,'26春');assert.equal(result[0].items[2].items[0].text,'控运球训练');assert.equal(nodes[0].text,'旧栏目');
 assert.equal(pageTitle('---\ntitle: old\n---\n\n```md\n# 假标题\n```\n\n# **控运球** &amp; [训练](./x) {#fixed}\n'),'控运球 & 训练');assert.equal(pageTitle('没有主标题','旧别名'),'旧别名');
});
