<script setup lang="ts">
import { onMounted } from 'vue'
import { withBase } from 'vitepress'
onMounted(() => {
  if (!document.querySelector('link[data-tactics-style]')) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = withBase('/tactics-runtime/player.css')
    link.dataset.tacticsStyle = ''
    document.head.append(link)
  }
  if (!document.querySelector('script[data-tactics-script]')) {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = withBase('/tactics-runtime/boot.js')
    script.dataset.tacticsScript = ''
    document.head.append(script)
  }
})
</script>
<template><span hidden aria-hidden="true"></span></template>
