import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeBlock,decodeBlock} from '../web/block-clipboard.js';
import {parseDocument,serializeDocument} from '../document.mjs';

test('element clipboard preserves editable titles, table breaks, media attributes and tactics references across save/reopen',()=>{
  const sources=[
    ':::: element 练习安排\n\n| 项目 | 要求 |\n| --- | --- |\n| 传球 | 抬头<br>找人 |\n\n::::\n',
    '<video src="/editor-media/demo.mp4" controls width="320" style="max-width:70%"></video>\n',
    '::: media-grid\n![示范](/editor-media/demo.png)\n\n<video src="/editor-media/demo.mp4" controls></video>\n:::\n',
    '<floorball-tactics src="/editor-media/tactics-123.json"></floorball-tactics>\n'
  ];
  for(const source of sources){
    const original=parseDocument(source).blocks[0];const before=structuredClone(original);
    const payload=encodeBlock(original,'project');const copy=decodeBlock(payload.html,'project');
    assert.equal(copy.raw,original.raw);assert.equal(copy.title,original.title);assert.deepEqual(original,before);
    const reopened=parseDocument(serializeDocument({frontmatter:'',blocks:[copy],tail:''}));
    assert.equal(reopened.blocks[0].type,original.type);assert.equal(reopened.blocks[0].raw,original.raw);
    assert.equal(payload.text,source);copy.meta??={};copy.meta.changed=true;assert.deepEqual(original,before);
  }
});
test('copies drop source block targets and custom heading ids without changing source links',()=>{
  const block=parseDocument('<div id="editor-block-abcdef"></div>\n\n## 练习 {#practice}\n').blocks[0];
  const copy=decodeBlock(encodeBlock(block,'p').html,'p');
  assert.equal(copy.prefix,'\n\n');assert.doesNotMatch(copy.raw,/practice/);assert.equal(copy.meta.anchor,undefined);assert.match(block.raw,/practice/);
});
test('unrelated or invalid clipboard data is rejected and cross-project assets are not silently reused',()=>{
  assert.equal(decodeBlock('<p>普通文字</p>','p'),null);
  assert.throws(()=>decodeBlock('<div data-floorball-editor-block="%broken">','p'));
  assert.throws(()=>decodeBlock(encodeBlock({type:'video',raw:'<video></video>'},'a').html,'b'),/同一个项目/);
  assert.throws(()=>encodeBlock({type:'unknown',raw:''},'p'));
  assert.throws(()=>encodeBlock({type:'raw',raw:'x'.repeat(4*1024*1024+1)},'p'));
});
