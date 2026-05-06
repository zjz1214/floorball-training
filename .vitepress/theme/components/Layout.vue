<template>
  <DefaultTheme.Layout>
    <template #home-hero-image>
      <div class="author-card">
        <img src="/头像.jpg" alt="哲宝" class="author-avatar" />
        <div class="author-info">
          <span class="author-name">作者：哲宝</span>
          <a class="author-email" href="mailto:zjz38237@stu.pku.edu.cn">zjz38237@stu.pku.edu.cn</a>
          <span class="author-wechat">视频号：哲宝&软曲</span>
        </div>
      </div>
    </template>
    <template #layout-bottom>
      <div class="visitor-counter">
        <span>访问 <span id="busuanzi_value_site_pv">-</span> 次</span>
        <span>&nbsp;|&nbsp;</span>
        <span><span id="busuanzi_value_site_uv">-</span> 人</span>
      </div>
      <ClientOnly>
        <Live2DCanvas />
      </ClientOnly>
    </template>
  </DefaultTheme.Layout>
</template>

<script setup>
import DefaultTheme from 'vitepress/theme'
import TreeTOC from './TreeTOC.vue'
</script>
