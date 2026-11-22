import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { createHash } from 'node:crypto';

export const categories = ['软曲简介', '个人技术基础', '个人技术进阶', '专项练习', '团队训练', '校队训练记录', '训练计划', '装备器材', '比赛经验', '发力原理解析', '热身及小游戏'];
export const hash = text => createHash('sha256').update(text).digest('hex');
export const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const md = new MarkdownIt({ html: true, linkify: true, breaks: false });
for (const name of ['tip', 'info', 'warning', 'danger', 'details', 'media-grid', 'element']) {
  md.use(container, name, { render(tokens, i) {
    if (tokens[i].nesting === -1) return name==='element'?'</figure>\n':'</div>\n';
    const title = tokens[i].info.trim().slice(name.length).trim();
    if(name==='element')return `<figure class="element-block">${title?`<figcaption class="element-title">${escapeHTML(title)}</figcaption>`:''}\n`;
    return `<div class="${name === 'media-grid' ? name : `${name} custom-block`}">${title ? `<p class="custom-block-title">${escapeHTML(title)}</p>` : ''}\n`;
  } });
}

export function splitFrontmatter(source) {
  const match = source.match(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  return { frontmatter: match?.[0] || '', body: source.slice(match?.[0].length || 0) };
}

// Keep source slices, including whitespace. Untouched blocks round-trip byte for byte.
export function parseBlocks(body) {
  const lines = body.match(/[^\n]*\n|[^\n]+$/g) || [];
  const offsets = [0];
  for (const line of lines) offsets.push(offsets.at(-1) + line.length);
  const tokens = md.parse(body, {});
  const ranges = [];
  let covered = 0;
  for (const token of tokens) {
    if (!token.map || token.level !== 0 || token.map[0] < covered) continue;
    let end=token.map[1];
    // markdown-it-container's map ends before the closing fence. Keep that fence with its block.
    if(token.type.startsWith('container_')&&token.nesting===1&&/^\s*:{3,}\s*$/.test(lines[end]||''))end++;
    ranges.push({ start: offsets[token.map[0]], end: offsets[end] ?? body.length, token });
    covered = end;
  }
  const blocks = []; let cursor = 0;
  for (const range of ranges) {
    const prefix = body.slice(cursor, range.start);
    const raw = body.slice(range.start, range.end);
    blocks.push(classify(raw, prefix, range.token));
    cursor = range.end;
  }
  if (!blocks.length && body) return { blocks: [{ type: 'raw', raw: body, prefix: '', html: md.render(body) }], tail: '' };
  // Bind invisible block anchors to the following block so moving/editing it keeps links valid.
  for(let i=0;i<blocks.length-1;i++){
    if(/^\s*<div id="editor-block-[a-f0-9]+"><\/div>\s*$/.test(blocks[i].raw)){
      const marker=blocks[i];blocks[i+1].prefix=marker.prefix+marker.raw+blocks[i+1].prefix;blocks.splice(i,1);i--;
    }
  }
  return { blocks, tail: body.slice(cursor) };
}

function classify(raw, prefix, token) {
  const tactics=raw.match(/^\s*<div class="floorball-tactics" data-tactics-src="(\/tactics\/[a-f0-9]{64}\.json)"><\/div>\s*$/);
  if(tactics)return {type:'tactics',prefix,raw,meta:{src:tactics[1]},html:raw};
  if(token.type==='container_element_open'){
    const first=raw.indexOf('\n');const end=raw.match(/\n\s*:{3,}\s*(?:\r?\n)?$/);
    if(first>=0&&end){
      const body=raw.slice(first+1,end.index);const children=parseBlocks(body);
      const child=children.blocks[0];
      const mediaCaption=child&&['video','image'].includes(child.type)&&children.blocks.slice(1).every(b=>b.type==='text');
      if(child&&!Object.hasOwn(child,'contentRaw')&&(['table','video','image','gallery'].includes(child.type))&&(children.blocks.length===1||mediaCaption)){
        return {...child,prefix,raw,title:token.info.trim().slice('element'.length).trim(),contentRaw:body,html:md.render(body)};
      }
    }
  }
  let type = 'raw'; const meta = {};
  if ((raw.match(/<video\b/gi) || []).length === 1 && /^\s*<video\b[^>]*>[\s\S]*?<\/video>\s*$/i.test(raw)) type = 'video';
  else if (token.type === 'heading_open' && /^h[1-4]$/.test(token.tag)) {
    type = 'heading'; meta.level = Number(token.tag[1]);
    meta.anchor = raw.match(/\s+(\{#[^}\n]+\})\s*$/)?.[1] || '';
  } else if (token.type === 'paragraph_open' && !/<\/?[a-z][^>]*>/i.test(raw)) type = /^!\[[^\]]*\]\([^\n]+\)\s*$/.test(raw) ? 'image' : 'text';
  else if (['bullet_list_open', 'ordered_list_open'].includes(token.type) && !/<\/?[a-z][^>]*>/i.test(raw)) type = 'list';
  else if (token.type === 'table_open' && !/<\/?[a-z][^>]*>/i.test(raw.replace(/<\/?(?:br|ol|ul|li|p|div|strong|b|em|i|s|del|strike|code|a)\b[^>]*>/gi,''))) type = 'table';
  else if (token.type === 'blockquote_open' && !/<\/?[a-z][^>]*>/i.test(raw)) type = 'quote';
  else if (token.type === 'hr') type = 'divider';
  else if (/^container_(tip|info|warning|danger)_open$/.test(token.type) && !/<\/?[a-z][^>]*>/i.test(raw)) {
    type = 'callout'; meta.kind = token.info.trim().split(/\s/)[0];
    meta.title = token.info.trim().slice(meta.kind.length).trim();
  } else if (token.type === 'container_media-grid_open') type = 'gallery';
  else if (token.type === 'html_block' && /^\s*<video\b/i.test(raw) && /^\s*<video\b[^>]*>(?:[\s\S]*?)<\/video>\s*$/i.test(raw)) type = 'video';
  return { type, prefix, raw, meta, html: md.render(raw) };
}

export function parseDocument(source) {
  const { frontmatter, body } = splitFrontmatter(source);
  return { frontmatter, ...parseBlocks(body), version: hash(source) };
}

export function serializeDocument(document) {
  if (!document || !Array.isArray(document.blocks) || document.blocks.length > 10000) throw new Error('页面内容格式不正确');
  return document.frontmatter + document.blocks.map(b => (b.prefix ?? '\n\n') + String(b.raw ?? '')).join('') + (document.tail || '');
}

export function pageClass(category, filename = '') {
  return ['软曲简介','装备器材','比赛经验','发力原理解析'].includes(category) || category === '其他' && filename !== '热身及小游戏.md' ? 'reading-preview' : 'technical-reading';
}

export function validateDocument(source, exists) {
  const warnings = []; const { body } = splitFrontmatter(source);
  const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)];
  if (headings.filter(m => m[1].length === 1).length !== 1) warnings.push('建议保留一个页面主标题。');
  for (let i = 1; i < headings.length; i++) if (headings[i][1].length > headings[i - 1][1].length + 1) { warnings.push('有标题跳级，建议按章节、分组、细节依次组织。'); break; }
  for (const m of source.matchAll(/(?:src=["']|!\[[^\]]*\]\()(\/[^\s"')]+)/g)) {
    const path = m[1].replace(/^\/floorball-training\//, '/').split(/[?#]/)[0];
    if (!exists(path)) warnings.push(`找不到媒体文件：${path}`);
  }
  return [...new Set(warnings)];
}

// Same heading-group contract as config.ts; the live site remains the final preview.
export function renderPreview(body) {
  const tokens = md.parse(body, {}); const Token = tokens[0]?.constructor;
  if (!Token) return '';
  const output = []; const stack = [];
  const close = depth => { while (stack.length > depth) output.push(Object.assign(new Token('html_block', '', 0), { content: `</div><!-- ${stack.pop()} -->` })); };
  for (const token of tokens) {
    if (token.type === 'heading_open' && token.level === 0) {
      if (['h1', 'h2'].includes(token.tag)) close(0);
      if (token.tag === 'h3') { close(0); stack.push('h3'); output.push(Object.assign(new Token('html_block', '', 0), { content: '<div class="h3-card">' })); }
      if (token.tag === 'h4') { close(Math.min(1, stack.length)); stack.push('h4'); output.push(Object.assign(new Token('html_block', '', 0), { content: '<div class="h4-card">' })); }
    }
    output.push(token);
  }
  close(0);
  let html = md.renderer.render(output, md.options, {});
  html = html.replace(/<div class="media-grid">([\s\S]*?)<\/div>/g, (_, inner) => `<div class="media-grid">${inner.replace(/<p>([\s\S]*?)<\/p>/g, '<div class="media-item"><p>$1</p></div>')}</div>`);
  return html;
}
