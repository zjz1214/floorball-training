<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import VPNavBarMenuLink from 'vitepress/dist/client/theme-default/components/VPNavBarMenuLink.vue'
import VPNavBarMenuGroup from 'vitepress/dist/client/theme-default/components/VPNavBarMenuGroup.vue'

const { theme } = useData()
const route = useRoute()
const items = computed(() => theme.value.nav ?? [])
const visibleCount = ref(0)
const container = ref<HTMLElement>()
const measurements = ref<HTMLElement>()
const moreMeasurement = ref<HTMLElement>()
const visibleItems = computed(() => items.value.slice(0, visibleCount.value))
const overflowItem = computed(() => ({
  text: '更多',
  items: items.value.slice(visibleCount.value).map((item) => {
    if ('link' in item || 'component' in item) return item
    const firstPage = item.items.find((child) => 'link' in child)
    if (!firstPage || !('link' in firstPage)) return item
    // Grouped categories have an overview in their child pages' directory.
    const link = firstPage.link.slice(0, firstPage.link.lastIndexOf('/') + 1)
    return { text: item.text, link, activeMatch: item.activeMatch }
  })
}))
let observer: ResizeObserver | undefined
let mounted = false

function measure() {
  if (!container.value || !measurements.value || !moreMeasurement.value) return
  const available = container.value.getBoundingClientRect().width
  if (!available) return
  const widths = Array.from(measurements.value.children, (el) => el.getBoundingClientRect().width)
  const total = widths.reduce((sum, width) => sum + width, 0)
  if (total <= available - 2) {
    visibleCount.value = items.value.length
    return
  }
  const budget = available - moreMeasurement.value.getBoundingClientRect().width - 2
  let count = 0
  let used = 0
  for (const width of widths) {
    if (used + width > budget) break
    used += width
    count++
  }
  visibleCount.value = count
}

function scheduleMeasure() {
  measure()
}

onMounted(() => {
  mounted = true
  observer = new ResizeObserver(scheduleMeasure)
  if (container.value) observer.observe(container.value)
  if (measurements.value) observer.observe(measurements.value)
  window.addEventListener('resize', scheduleMeasure)
  document.fonts.ready.then(() => { if (mounted) scheduleMeasure() })
  scheduleMeasure()
})

watch([items, () => route.path], async () => {
  await nextTick()
  if (mounted) scheduleMeasure()
}, { flush: 'post' })

onBeforeUnmount(() => {
  mounted = false
  observer?.disconnect()
  window.removeEventListener('resize', scheduleMeasure)
})
</script>

<template>
  <nav ref="container" class="responsive-nav" aria-label="主导航">
    <template v-for="item in visibleItems" :key="JSON.stringify(item)">
      <VPNavBarMenuLink v-if="'link' in item" :item="item" />
      <component v-else-if="'component' in item" :is="item.component" v-bind="item.props" />
      <VPNavBarMenuGroup v-else :item="item" />
    </template>
    <VPNavBarMenuGroup v-if="overflowItem.items.length" :item="overflowItem" class="responsive-nav-more" />

    <div class="nav-measurements" aria-hidden="true" inert>
      <div ref="measurements" class="nav-measurement-items">
        <div v-for="item in items" :key="JSON.stringify(item)" class="nav-measurement-item">
          <VPNavBarMenuLink v-if="'link' in item" :item="item" />
          <component v-else-if="'component' in item" :is="item.component" v-bind="item.props" />
          <VPNavBarMenuGroup v-else :item="item" />
        </div>
      </div>
      <div ref="moreMeasurement" class="nav-measurement-more">
        <VPNavBarMenuGroup :item="{ text: '更多', items: [] }" />
      </div>
    </div>
  </nav>
</template>

<style scoped>
.responsive-nav {
  display: none;
  flex: 1 1 0;
  min-width: 0;
  justify-content: flex-end;
}
@media (min-width: 768px) {
  .responsive-nav { display: flex; }
}
.responsive-nav > :deep(.VPNavBarMenuLink),
.responsive-nav > :deep(.VPNavBarMenuGroup) { flex-shrink: 0; }
.nav-measurements {
  position: fixed;
  top: 0;
  left: 0;
  width: max-content;
  visibility: hidden;
  pointer-events: none;
  contain: layout;
}
.nav-measurement-items { display: flex; width: max-content; }
.nav-measurement-item,
.nav-measurement-more { width: max-content; }
.responsive-nav-more :deep(.VPMenu) {
  max-width: min(360px, calc(100vw - 32px));
}
</style>
