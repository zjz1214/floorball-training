import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories, parseDocument, serializeDocument, splitFrontmatter, renderPreview } from '../document.mjs';
import { updateElementSource } from '../web/element.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
test('all current published pages round-trip without changing a single source character', async () => {
  const names = ['index.md'];
  for (const dir of categories) for (const filename of await fs.readdir(path.join(root, dir))) if (filename.endsWith('.md')) names.push(`${dir}/${filename}`);
  assert.ok(names.length >= 48);
  for (const name of names) {
    const source = await fs.readFile(path.join(root, name), 'utf8');
    assert.equal(serializeDocument(parseDocument(source)), source, name);
  }
});
test('editing one paragraph preserves frontmatter, custom anchors, nested lists and media markup', () => {
  const source = '---\r\npageClass: technical-reading\r\ncustom: keep\r\n---\r\n\r\n# 测试\r\n\r\n旧正文\r\n\r\n### 练习 {#drill}\r\n\r\n- 一级\r\n  - 二级\r\n\r\n<video src="/v.mp4" width="310" controls autoplay loop></video>\r\n';
  const doc = parseDocument(source);
  const paragraph = doc.blocks.find(b => b.type === 'text'); assert.ok(paragraph); paragraph.raw = '新的正文\r\n';
  assert.equal(serializeDocument(doc), source.replace('旧正文', '新的正文'));
  assert.equal(splitFrontmatter(serializeDocument(doc)).frontmatter, splitFrontmatter(source).frontmatter);
});
test('containers form single editable blocks and unknown markup stays protected', () => {
  const source = '::: tip 训练要点\n- 抬头\n- 观察\n:::\n\n::: media-grid\n<video src="/a.mp4" controls></video>\n动作一\n\n<video src="/b.mp4" controls></video>\n动作二\n:::\n\n<CustomWidget :value="1" />\n';
  const doc = parseDocument(source);
  assert.deepEqual(doc.blocks.map(x => x.type), ['callout','gallery','raw']);
  assert.match(doc.blocks[0].raw,/\n:::\r?\n$/);assert.match(doc.blocks[1].raw,/\n:::\r?\n$/);
  assert.equal(serializeDocument(doc), source);
  const html = renderPreview('### 练习\n\n'+source); assert.match(html,/h3-card/); assert.match(html,/media-grid/); assert.match(html,/custom-block/);
});
test('unmapped whitespace and code fences are preserved', () => {
  for (const source of ['', '\n\n', '\uFEFF---\npageClass: technical-reading\n---\n\n# 标题\n\n```html\n<video src="x" />\n```\n\n']) assert.equal(serializeDocument(parseDocument(source)),source);
});
test('a single inline HTML video is editable while its dimensions and playback flags remain untouched', () => {
  const source = '<video src="/test.mp4" width="310" controls autoplay loop muted playsinline></video>\r\n';
  const document = parseDocument(source); assert.equal(document.blocks[0].type, 'video'); assert.equal(serializeDocument(document), source);
});
test('block anchors remain bound to their content without changing whitespace on open/save',()=>{
 const source='# 页面\n\n<div id="editor-block-1234abcdef"></div>\n\n正文\n';const doc=parseDocument(source);
 assert.equal(doc.blocks.length,2);assert.match(doc.blocks[1].prefix,/editor-block-1234abcdef/);assert.equal(serializeDocument(doc),source);
 doc.blocks[1].raw='修改正文\n';assert.match(serializeDocument(doc),/editor-block-1234abcdef[\s\S]*修改正文/);
});
test('table line breaks, links and emphasis stay editable after repeated save/reopen',()=>{
 let source='# 训练\n\n| 项目 | 内容 |\n| --- | --- |\n| 一 | **观察**<br>第二行 [配合](./配合) |\n';
 for(let i=0;i<3;i++){
  const doc=parseDocument(source);const table=doc.blocks.find(b=>b.type==='table');assert.ok(table,'table became protected');assert.match(table.html,/<br>/);assert.equal(serializeDocument(doc),source);
  table.raw=table.raw.replace('第二行','第二行修改');source=serializeDocument(doc);
 }
 assert.match(source,/第二行修改修改修改/);
});
test('titled tables and nested media grids round-trip and remain editable',()=>{
 const bodies=[['table','|  | 内容 |\n| --- | --- |\n| 1 | 第一行<br>第二行 |\n'],['gallery','::: media-grid\n<video src="/one.mp4" controls autoplay muted></video>\n动作一\n\n<video src="/two.mp4" controls></video>\n动作二\n:::\n'],['video','<video src="/one.mp4" style="max-width:50%" controls></video>\n\n动作说明\n']];
 for(const [type,body] of bodies){
  const b={type,raw:body,title:'示范标题'};updateElementSource(b,body);const source='# 页面\n\n'+b.raw;const doc=parseDocument(source);const block=doc.blocks[1];
  assert.equal(doc.blocks.length,2);assert.equal(block.type,type);assert.equal(block.title,'示范标题');assert.equal(serializeDocument(doc),source);assert.doesNotMatch(renderPreview(source),/<p>:{3,}<\/p>/);
  block.title='新的标题';updateElementSource(block,block.contentRaw);const next=parseDocument(serializeDocument(doc));assert.equal(next.blocks[1].type,type);assert.equal(next.blocks[1].title,'新的标题');
  next.blocks[1].title='';updateElementSource(next.blocks[1],next.blocks[1].contentRaw);assert.equal(parseDocument(serializeDocument(next)).blocks[1].type,type);
 }
});
test('unsupported deeper element nesting is preserved rather than flattened',()=>{
 const source='::: element 外层\n\n::: element 内层\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n:::\n\n:::\n';const doc=parseDocument(source);assert.equal(doc.blocks[0].type,'raw');assert.equal(serializeDocument(doc),source);
});
