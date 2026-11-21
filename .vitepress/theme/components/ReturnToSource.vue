<template>
  <button v-if="visible" class="return-to-source" @click="returnToSource">← 返回原文</button>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, useRoute, useRouter } from 'vitepress'

type Source = { from: string; to: string; y: number }
const key = 'floorball-return-source-v1'
const { site } = useData()
const route = useRoute()
const router = useRouter()
const stack = ref<Source[]>([])
const current = ref('')
let returning = false
function normalized(href: string) {
  const u = new URL(href, location.origin)
  return decodeURI(u.pathname).replace(/\/index(?:\.html)?$/, '/').replace(/\.html$/, '').replace(/\/$/, '') + u.search + decodeURI(u.hash)
}
const visible = computed(() => !!stack.value.length && !!current.value && normalized(stack.value.at(-1)!.to) === normalized(current.value))
function persist() { try { sessionStorage.setItem(key, JSON.stringify(stack.value)) } catch {} }
function sync() { current.value = location.href }
function hashChanged(event: HashChangeEvent) {
  if (!returning && event.oldURL && event.newURL) {
    const previous = normalized(event.oldURL)
    const destination = normalized(event.newURL)
    const top = stack.value.at(-1)
    if (top && normalized(top.from) === destination) {
      stack.value.pop()
      persist()
    } else if (previous !== destination && previous.split('#')[0] === destination.split('#')[0]) {
      stack.value.push({ from: event.oldURL, to: event.newURL, y: window.scrollY })
      if (stack.value.length > 30) stack.value.shift()
      persist()
    }
  }
  sync()
}
function capture(event: MouseEvent) {
  if (returning || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  const anchor = (event.target as Element)?.closest<HTMLAnchorElement>('.vp-doc a[href]')
  if (!anchor || anchor.classList.contains('header-anchor') || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self') return
  const destination = new URL(anchor.href)
  if (destination.origin !== location.origin || !destination.pathname.startsWith(site.value.base) || /\.(pdf|mp4|webm|png|jpe?g|gif|svg|webp|avif)$/i.test(destination.pathname)) return
  if (normalized(destination.href) === normalized(location.href)) return
  stack.value.push({ from: location.href, to: destination.href, y: window.scrollY })
  if (stack.value.length > 30) stack.value.shift()
  persist()
  setTimeout(sync, 0)
}
async function returnToSource() {
  const source = stack.value.pop()
  if (!source || returning) return
  returning = true
  persist()
  try {
    await router.go(source.from)
    await nextTick()
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: source.y, behavior: 'instant' })))
    sync()
  } finally { returning = false }
}
watch(() => route.path, async () => { await nextTick(); setTimeout(sync, 0) })
onMounted(() => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || '[]')
    if (Array.isArray(saved)) stack.value = saved.filter((s: Source) => typeof s.from === 'string' && typeof s.to === 'string' && Number.isFinite(s.y) && new URL(s.from).origin === location.origin && new URL(s.to).origin === location.origin).slice(-30)
  } catch {}
  sync()
  // VitePress emits hashchange before scrolling; keep the original reading position there.
  window.addEventListener('click', capture, true)
  window.addEventListener('hashchange', hashChanged)
  window.addEventListener('popstate', sync)
})
onUnmounted(() => {
  window.removeEventListener('click', capture, true)
  window.removeEventListener('hashchange', hashChanged)
  window.removeEventListener('popstate', sync)
})
</script>

<style scoped>
.return-to-source {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 12;
  padding: 10px 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
  box-shadow: 0 4px 18px rgb(0 0 0 / 8%);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.return-to-source:hover { background: var(--vp-c-bg-soft); }
.return-to-source:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
@media (max-width: 767px) { .return-to-source { right: 16px; bottom: 16px; } }
</style>
