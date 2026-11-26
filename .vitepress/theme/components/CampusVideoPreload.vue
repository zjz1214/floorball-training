<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vitepress'

const campusHost = '10.129.240.240'
const route = useRoute()
let observer: IntersectionObserver | undefined

function observePageVideos() {
  if (!observer) return
  observer.disconnect()
  for (const video of document.querySelectorAll<HTMLVideoElement>('.vp-doc video[preload="none"]')) {
    const source = video.getAttribute('src') || video.querySelector('source[src]')?.getAttribute('src')
    if (source && new URL(source, location.href).origin === location.origin) observer.observe(video)
  }
}

onMounted(() => {
  if (location.hostname !== campusHost) return
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !observer) continue
      const video = entry.target as HTMLVideoElement
      video.preload = 'auto'
      observer.unobserve(video)
    }
  }, { rootMargin: '320px 0px' })
  observePageVideos()
})
watch(() => route.path, async () => {
  await nextTick()
  observePageVideos()
}, { flush: 'post' })
onUnmounted(() => {
  observer?.disconnect()
  observer = undefined
})
</script>

<template><span hidden aria-hidden="true"></span></template>
