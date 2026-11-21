import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupPages,groupSidebar} from '../groups.mjs';
test('third-level groups preserve page order, links and unassigned pages',()=>{
 const items=[{path:'A/index.md',link:'/A/',text:'概述'},{path:'A/two.md',link:'/A/two',text:'二'},{path:'A/one.md',link:'/A/one',text:'一'}];
 const groups=[{id:'fall',name:'秋季',pages:['A/one.md','A/two.md']},{id:'empty',name:'春季',pages:[]}];
 const original=JSON.stringify({items,groups});
 const nodes=groupPages(items,groups);assert.equal(nodes[0].page.path,'A/index.md');assert.deepEqual(nodes[1].pages.map(p=>p.path),['A/two.md','A/one.md']);assert.equal(nodes[2].pages.length,0);
 const sidebar=groupSidebar(items,groups,p=>p.path);assert.equal(sidebar[0].link,'/A/');assert.equal(sidebar[1].text,'秋季');assert.equal(sidebar[1].collapsed,true);assert.deepEqual(sidebar[1].items.map(p=>p.link),['/A/two','/A/one']);assert.equal(JSON.stringify({items,groups}),original);
});
