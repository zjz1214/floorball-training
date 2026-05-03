<template>
  <nav v-if="tree.length" class="tree-toc">
    <div class="tree-toc-title">目录</div>
    <ul class="toc-list">
      <TocNode
        v-for="node in tree"
        :key="node.id"
        :node="node"
        :active-id="activeId"
        @toggle="(id) => toggleNode(tree, id)"
      />
    </ul>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineComponent, h } from 'vue'

const TocNode = defineComponent({
  name: 'TocNode',
  props: { node: Object, activeId: String },
  emits: ['toggle'],
  setup(props, { emit }) {
    return () => {
      const { node, activeId } = props
      const isActive = activeId === node.id
      const hasActiveChild = node.children.some(c => c.id === activeId || c.children.some(g => g.id === activeId))
      const hasChildren = node.children.length > 0

      return h('li', {
        class: ['toc-item', { active: isActive, 'has-active-child': hasActiveChild, expanded: node.expanded }]
      }, [
        h('div', {
          class: ['toc-link', `toc-level-${node.level}`],
          onClick: () => {
            emit('toggle', node.id)
            const el = document.getElementById(node.id)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, [
          hasChildren ? h('span', { class: 'toc-arrow' }, node.expanded ? '▾' : '▸') : null,
          h('span', { class: 'toc-text' }, node.text)
        ]),
        hasChildren && node.expanded
          ? h('ul', { class: 'toc-children' },
              node.children.map(child =>
                h(TocNode, { node: child, activeId, key: child.id, onToggle: (id) => emit('toggle', id) })
              )
            )
          : null
      ])
    }
  }
})

const tree = ref([])
const activeId = ref('')
let observer = null

function buildTree() {
  const headings = document.querySelectorAll('.vp-doc h2, .vp-doc h3, .vp-doc h4')
  const result = []
  const stack = [] // stack of parent nodes by level

  headings.forEach(h => {
    const level = parseInt(h.tagName[1])
    const id = h.id
    const text = h.textContent.replace(/#$/, '').trim()
    const node = { level, text, id, children: [], expanded: level <= 3 }

    // Find appropriate parent
    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop()
    }
    if (stack.length) {
      stack[stack.length - 1].children.push(node)
    } else {
      result.push(node)
    }
    stack.push(node)
  })

  tree.value = result
}

function toggleNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) {
      n.expanded = !n.expanded
      return
    }
    if (n.children.length) toggleNode(n.children, id)
  }
}

function setupObserver() {
  const headingEls = document.querySelectorAll('.vp-doc h2[id], .vp-doc h3[id], .vp-doc h4[id]')
  observer = new IntersectionObserver(
    (entries) => {
      // Find the first heading that is currently intersecting (top of viewport)
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible.length) {
        activeId.value = visible[0].target.id
      }
    },
    { rootMargin: '-80px 0px -60% 0px' }
  )
  headingEls.forEach(el => observer.observe(el))
}

onMounted(() => {
  buildTree()
  setupObserver()
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>

<style scoped>
.tree-toc {
  font-size: 0.82rem;
  padding: 12px 12px 8px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.tree-toc-title {
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 6px;
  color: var(--vp-c-text-1);
  letter-spacing: 0.5px;
}
.toc-list, .toc-children {
  list-style: none;
  padding: 0;
  margin: 0;
}
.toc-children {
  padding-left: 10px;
  border-left: 1px solid var(--vp-c-divider);
  margin-left: 5px;
}
.toc-item {
  margin: 0;
}
.toc-link {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px;
  border-radius: 3px;
  cursor: pointer;
  color: var(--vp-c-text-2);
  transition: all 0.15s;
  line-height: 1.5;
}
.toc-link:hover {
  color: var(--vp-c-brand-1);
}
.toc-item.active > .toc-link {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
.toc-arrow {
  font-size: 0.65rem;
  color: var(--vp-c-text-3);
  min-width: 10px;
  text-align: center;
  flex-shrink: 0;
}
.toc-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
}
.toc-level-2 { padding-left: 0; }
.toc-level-3 { padding-left: 2px; }
.toc-level-4 {
  padding-left: 6px;
  font-size: 0.76rem;
}
</style>
