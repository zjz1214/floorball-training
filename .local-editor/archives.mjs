export function isArchived(archive, page) {
  return archive.pages.includes(page) || archive.categories.includes(page.split('/')[0]);
}

export function archivePatterns(archive) {
  const escapeGlob = value => value.replace(/([!*?{}()[\]\\])/g, '\\$1');
  return [...archive.pages.map(escapeGlob), ...archive.categories.map(category => `${escapeGlob(category)}/**` )];
}

export function mergeVisibleOrder(previous, visible, hidden) {
  const next = [...visible];
  const merged = previous.flatMap(item => hidden(item) ? [item] : next.length ? [next.shift()] : []);
  return [...merged, ...next];
}
