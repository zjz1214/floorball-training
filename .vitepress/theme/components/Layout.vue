<template>
  <DefaultTheme.Layout>
    <template #home-hero-image>
      <div class="author-card">
        <img src="/头像.jpg" alt="哲宝" class="author-avatar" />
        <div class="author-info">
          <span class="author-name">哲宝</span>
          <a class="author-email" href="mailto:zjz38237@stu.pku.edu.cn">zjz38237@stu.pku.edu.cn</a>
        </div>
      </div>
    </template>
    <template #sidebar-nav-before>
      <TreeTOC />
    </template>
  </DefaultTheme.Layout>
</template>

<script setup>
import DefaultTheme from 'vitepress/theme'
import TreeTOC from './TreeTOC.vue'
</script>
