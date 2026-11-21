import test from 'node:test';
import assert from 'node:assert/strict';
import {applyNavigationNames} from '../names.mjs';
test('navigation labels change without changing links or mutating source data',()=>{
 const input=[{text:'首页',link:'/'},{text:'训练计划',items:[{text:'概述',link:'/训练计划/'},{text:'传球与接球',link:'/训练计划/传球与接球'}]},{text:'其他',link:'/其他/'}];
 const names={pages:{'index.md':'网站主页','训练计划/传球与接球.md':'传接球课'},categories:{'训练计划':'课程安排','其他':'参考资料'}};
 const result=applyNavigationNames(input,names);assert.equal(result[0].text,'网站主页');assert.equal(result[1].text,'课程安排');assert.equal(result[1].items[1].text,'传接球课');assert.equal(result[1].items[1].link,input[1].items[1].link);assert.equal(result[2].text,'参考资料');assert.equal(input[1].text,'训练计划');
});
