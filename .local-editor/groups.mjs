// Group membership changes navigation only; source paths and links stay stable.
export function groupPages(pages, groups = [], key = page => page.path) {
  const assigned = new Set(groups.flatMap(group => group.pages));
  return [
    ...pages.filter(page => !assigned.has(key(page))).map(page => ({ type: 'page', page })),
    ...groups.map(group => ({ type: 'group', id: group.id, name: group.name,
      pages: pages.filter(page => group.pages.includes(key(page))) }))
  ];
}
export function groupSidebar(items, groups, key) {
  return groupPages(items, groups, key).map(node => node.type === 'page' ? node.page :
    { text: node.name, collapsed: true, items: node.pages });
}
