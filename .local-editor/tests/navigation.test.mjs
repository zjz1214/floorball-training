import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLink } from '../web/navigation.js';
const origin='http://127.0.0.1:5174';const pages=['index.md','个人技术基础/index.md','个人技术基础/控球训练.md','个人技术基础/运球.md'];
test('links resolve relative pages, directory indexes, custom hashes and site-preview URLs',()=>{
  assert.deepEqual(resolveLink('./运球#练习','个人技术基础/控球训练.md',pages,origin),{type:'page',path:'个人技术基础/运球.md',hash:'练习'});
  assert.equal(resolveLink('/floorball-training/个人技术基础/','index.md',pages,origin).path,'个人技术基础/index.md');
  assert.equal(resolveLink('#drill-1','个人技术基础/控球训练.md',pages,origin).hash,'drill-1');
  assert.equal(resolveLink('http://127.0.0.1:5173/floorball-training/个人技术基础/运球.html#x','index.md',pages,origin).path,'个人技术基础/运球.md');
  assert.equal(resolveLink('/floorball-training/','个人技术基础/控球训练.md',pages,origin).path,'index.md');
});
test('external URLs remain external and active schemes are not followed',()=>{
  assert.deepEqual(resolveLink('https://example.com/','index.md',pages,origin),{type:'external',href:'https://example.com/'});
  assert.equal(resolveLink('javascript:alert(1)','index.md',pages,origin),null);
});
