<template>
  <DefaultTheme.Layout>
    <template #nav-bar-content-after>
      <ClientOnly>
        <button v-if="!authState.authenticated" class="auth-nav-btn" @click="showAuthModal = true">
          登录
        </button>
        <button v-else class="auth-nav-btn auth-nav-btn-active" @click="handleLogout">
          已登录
        </button>
      </ClientOnly>
    </template>

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
      <div v-if="!(isHomepage || authState.authenticated)" class="auth-overlay">
        <div class="auth-overlay-content">
          <div class="auth-overlay-card">
            <div class="auth-overlay-icon">🔒</div>
            <h2 class="auth-overlay-title">此页面需要验证</h2>
            <p class="auth-overlay-desc">答对验证问题即可查看全部内容</p>
            <button class="auth-overlay-btn" @click="showAuthModal = true">去验证</button>
          </div>
        </div>
      </div>
      <div class="visitor-counter">
        <span>访问 <span id="busuanzi_value_site_pv">-</span> 次</span>
      </div>
      <ClientOnly>
        <Live2DCanvas v-if="isHomepage || authState.authenticated" />
      </ClientOnly>
    </template>
  </DefaultTheme.Layout>

  <AuthModal
    :show="showAuthModal"
    :question="authQuestion"
    :accepted-answers="authAcceptedAnswers"
    @close="showAuthModal = false"
    @success="onAuthSuccess"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useData, useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { useAuth } from '../composables/useAuth'
import AuthModal from './AuthModal.vue'
import Live2DCanvas from './Live2DCanvas.vue'

const { theme } = useData()
const route = useRoute()
const showAuthModal = ref(false)
const { authState, logout } = useAuth()

const isHomepage = computed(() => route.path === '/' || route.path === '/floorball-training/')

const authQuestion = theme.value.authQuestion || '验证问题'
const authAcceptedAnswers = theme.value.authAcceptedAnswers || ['答案']

function onAuthSuccess() {
  showAuthModal.value = false
}

function handleLogout() {
  if (confirm('确定要退出登录吗？')) {
    logout()
  }
}
</script>

<style>
/* Nav auth button */
.auth-nav-btn {
  padding: 4px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  background: transparent;
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-border);
  transition: all 0.2s;
  white-space: nowrap;
}
.auth-nav-btn:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
.auth-nav-btn-active {
  background: var(--vp-c-brand-1);
  color: #fff;
  border-color: var(--vp-c-brand-1);
}
.auth-nav-btn-active:hover {
  background: var(--vp-c-brand-2);
  color: #fff;
}

/* Auth overlay — full viewport cover */
.auth-overlay {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: var(--vp-c-bg);
}
.auth-overlay-content {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding-top: var(--vp-nav-height);
}
.auth-overlay-card {
  text-align: center;
  max-width: 400px;
}
.auth-overlay-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.auth-overlay-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 0 0 8px;
}
.auth-overlay-desc {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin: 0 0 24px;
}
.auth-overlay-btn {
  padding: 10px 32px;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  background: var(--vp-c-brand-1);
  color: #fff;
  border: none;
  transition: background 0.2s;
}
.auth-overlay-btn:hover {
  background: var(--vp-c-brand-2);
}
</style>
