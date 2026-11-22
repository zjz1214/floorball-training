import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLink } from '../web/navigation.js';
import { textTarget,textTargetURL } from '../web/text-target.js';
const origin='http://127.0.0.1:5174';const pages=['index.md','个人技术基础/index.md','个人技术基础/控球训练.md','个人技术基础/运球.md'];

test('text links retain punctuation, repeated-phrase context and anchor fallback',()=>{
 const url=textTargetURL('/个人技术基础/运球#动作','观察, - 出球','第一次之后，','第二次之前。');
 const target=resolveLink(url,'index.md',pages,origin);const passage=textTarget(target.hash);
 assert.deepEqual(passage,{anchor:'动作',text:'观察, - 出球',prefix:'第一次之后，',suffix:'第二次之前。'});
 assert.equal(textTarget('普通锚点').text,'');
});
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
