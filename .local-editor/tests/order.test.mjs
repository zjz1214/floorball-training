import test from 'node:test';
import assert from 'node:assert/strict';
import {sortByOrder,sidebarPage} from '../order.mjs';
test('saved ordering is shared across directory and sidebar paths; new items append',()=>{
 const pages=[{path:'训练计划/index.md'},{path:'训练计划/甲.md'},{path:'训练计划/乙.md'},{path:'训练计划/新.md'}];
 const order=['训练计划/乙.md','训练计划/index.md','训练计划/甲.md'];
 assert.deepEqual(sortByOrder(pages,order).map(p=>p.path),[...order,'训练计划/新.md']);
 const sidebar=[{link:'/训练计划/'},{link:'/训练计划/甲'},{link:'/训练计划/乙'},{link:'/训练计划/新'}];
 assert.deepEqual(sortByOrder(sidebar,order,p=>sidebarPage(p.link)).map(p=>sidebarPage(p.link)),[...order,'训练计划/新.md']);
});
