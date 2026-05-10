<template>
  <DefaultTheme.Layout>
    <template #home-hero-image>
      <div class="author-area">
        <div class="author-card">
          <img src="/头像.jpg" alt="哲宝" class="author-avatar" />
          <div class="author-info">
            <span class="author-name">作者：哲宝</span>
            <a class="author-email" href="mailto:zjz38237@stu.pku.edu.cn">zjz38237@stu.pku.edu.cn</a>
            <span class="author-wechat">视频号：哲宝&软曲</span>
          </div>
        </div>
      <div class="friend-links">
        <div class="friend-links-header">友情链接</div>
        <a class="friend-link-item" href="https://pku-floorball.github.io/pkufloorball/" target="_blank" rel="noreferrer">1. 北大软式曲棍球官网</a>
        <a class="friend-link-item" href="https://pku-zyf.github.io/floorball-goalkeeper/" target="_blank" rel="noreferrer">2. 守门员手册</a>
      </div>
      </div>
    </template>
    <template #layout-bottom>
      <div class="visitor-counter">
        <span>访问 <span id="busuanzi_value_site_pv">-</span> 次</span>
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
