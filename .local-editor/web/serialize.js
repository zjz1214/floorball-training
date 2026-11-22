export function safeURL(value, media = false) {
  const s = String(value || '').trim();
  if (!s || /[\x00-\x20]/.test(s) || /^(?:javascript|data|vbscript|file):/i.test(s) || s.startsWith('//')) return '';
  if (/^[a-z][\w+.-]*:/i.test(s) && !/^(https?:|mailto:)/i.test(s)) return '';
  if (media && s.startsWith('mailto:')) return '';
  return s;
}
export function localMedia(src) {
  if (!src?.startsWith('/') || src.startsWith('//')) return src;
  return '/media/' + src.replace(/^\/floorball-training\//, '/').slice(1);
}
export function sanitize(html, mediaPaths = true) {
  const t = document.createElement('template'); t.innerHTML = html;
  t.content.querySelectorAll('script,style,iframe,object,embed,form,input,button,link,meta,base').forEach(e => e.remove());
  for (const e of t.content.querySelectorAll('*')) {
    for (const a of [...e.attributes]) {
      if (/^on/i.test(a.name) || ['srcdoc', 'contenteditable'].includes(a.name)) e.removeAttribute(a.name);
      if (['href', 'src', 'poster', 'xlink:href'].includes(a.name)) {
        const u = safeURL(a.value, a.name !== 'href');
        if (!u) e.removeAttribute(a.name); else e.setAttribute(a.name, mediaPaths && ['src', 'poster'].includes(a.name) ? localMedia(u) : u);
      }
      if (a.name === 'style') {
        const allowed = ['width', 'height', 'max-width', 'max-height', 'border-radius', 'color', 'background-color', 'text-align'];
        const css = allowed.map(k => [k, e.style.getPropertyValue(k)]).filter(([, v]) => v && !/url|expression/i.test(v));
        e.removeAttribute('style'); for (const [k, v] of css) e.style.setProperty(k, v);
      }
    }
    if (e.tagName === 'VIDEO') { e.removeAttribute('autoplay'); e.setAttribute('preload', 'metadata'); e.setAttribute('controls', ''); }
    if (e.tagName === 'A') { e.removeAttribute('target'); e.setAttribute('rel', 'noreferrer'); }
  }
  return t.innerHTML;
}
const escape = text => text.replace(/\\/g, '\\\\').replace(/([*`_[\]<>])/g, '\\$1');
const compact = s => s.replace(/\n{3,}/g, '\n\n').trim();
export function inline(node) {
  if (node.nodeType === Node.TEXT_NODE) return escape(node.textContent.replace(/\u00a0/g, ' '));
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const value = [...node.childNodes].map(inline).join('');
  switch (node.tagName) {
    case 'STRONG': case 'B': return value.trim() ? `**${value.trim()}** ` : value;
    case 'EM': case 'I': return value.trim() ? `*${value.trim()}* ` : value;
    case 'S': case 'DEL': case 'STRIKE': return `~~${value}~~`;
    case 'CODE': return '`' + node.textContent.replace(/`/g, '\\`') + '`';
    case 'A': { const href = safeURL(node.getAttribute('href')); return href ? `[${value}](${href.replace(/\(/g, '%28').replace(/\)/g, '%29')})` : value; }
    case 'BR': return '\n';
    case 'P': case 'DIV': return value + '\n\n';
    default: return value;
  }
}
function list(node, depth = 0) {
  const ordered = node.tagName === 'OL'; let index = Number(node.getAttribute('start') || 1);
  return [...node.children].filter(e => e.tagName === 'LI').map(li => {
    const nested = [...li.children].filter(e => ['UL', 'OL'].includes(e.tagName));
    const c = li.cloneNode(true); [...c.children].filter(e => ['UL', 'OL'].includes(e.tagName)).forEach(e => e.remove());
    const marker = ordered ? `${index++}. ` : '- ';
    const text = compact([...c.childNodes].map(inline).join('')); const lines = text.split('\n');
    return ' '.repeat(depth) + marker + lines[0] + lines.slice(1).map(x => '\n' + ' '.repeat(depth + marker.length) + x).join('') + nested.map(n => '\n' + list(n, depth + marker.length)).join('');
  }).join('\n');
}
export function htmlMarkdown(element) {
  function block(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim() ? escape(node.textContent) : '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const inside = () => [...node.childNodes].map(inline).join('');
    if (['UL', 'OL'].includes(node.tagName)) return '\n\n' + list(node) + '\n\n';
    if (node.tagName === 'BLOCKQUOTE') return '\n\n' + compact([...node.childNodes].map(block).join('')).split('\n').map(x => '> ' + x).join('\n') + '\n\n';
    if (node.tagName === 'TABLE') {
      const rows = [...node.querySelectorAll('tr')].map(tr => [...tr.children].map(td => {
        const content=td.querySelector('ol,ul')
          ?sanitize(td.innerHTML,false).replace(/\r?\n/g,' ')
          :compact([...td.childNodes].map(inline).join(''));
        return content.replace(/\|/g,'\\|').replace(/\n+/g,'<br>');
      }));
      const width = Math.max(1, ...rows.map(r => r.length));
      const row = r => '| ' + Array.from({ length: width }, (_, i) => r[i] || '').join(' | ') + ' |';
      return '\n\n' + [row(rows[0] || []), row(Array(width).fill('---')), ...rows.slice(1).map(row)].join('\n') + '\n\n';
    }
    if (/^H[1-4]$/.test(node.tagName)) return '\n\n' + '#'.repeat(Number(node.tagName[1])) + ' ' + compact(inside()) + '\n\n';
    if (['P', 'DIV'].includes(node.tagName)) {
      if ([...node.children].some(e => ['UL', 'OL', 'TABLE', 'BLOCKQUOTE'].includes(e.tagName))) return [...node.childNodes].map(block).join('');
      return inside() + '\n\n';
    }
    return inside();
  }
  return compact([...element.childNodes].map(block).join(''));
}
export function richPasteHTML(html) {
  const t = document.createElement('div'); t.innerHTML = sanitize(html, false);
  t.querySelectorAll('img,video,source,svg').forEach(e => e.remove());
  for (const e of t.querySelectorAll('*')) {
    for (const a of [...e.attributes]) if (a.name !== 'href' && !(e.tagName === 'OL' && a.name === 'start')) e.removeAttribute(a.name);
    if (!['P','DIV','BR','STRONG','B','EM','I','S','DEL','CODE','A','UL','OL','LI','TABLE','THEAD','TBODY','TR','TD','TH','BLOCKQUOTE'].includes(e.tagName)) e.replaceWith(...e.childNodes);
  }
  return t.innerHTML;
}
