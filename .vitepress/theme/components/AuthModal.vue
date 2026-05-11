<template>
  <Teleport to="body">
    <div v-if="show" class="auth-overlay" @click.self="$emit('close')">
      <div class="auth-modal">
        <h3 class="auth-title">{{ question }}</h3>
        <p class="auth-hint">答对即可查看受保护内容</p>
        <form @submit.prevent="handleSubmit">
          <input
            ref="inputRef"
            v-model="answer"
            type="text"
            class="auth-input"
            :placeholder="placeholder"
            autocomplete="off"
          />
          <p v-if="error" class="auth-error">{{ error }}</p>
          <div class="auth-actions">
            <button type="button" class="auth-btn auth-btn-cancel" @click="$emit('close')">取消</button>
            <button type="submit" class="auth-btn auth-btn-submit" :disabled="!answer.trim()">确认</button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useAuth } from '../composables/useAuth'

const props = defineProps<{
  show: boolean
  question: string
  placeholder?: string
  acceptedAnswers: string[]
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { login } = useAuth()
const answer = ref('')
const error = ref('')
const inputRef = ref<HTMLInputElement>()

async function handleSubmit() {
  error.value = ''
  if (!answer.value.trim()) return

  if (login(answer.value, props.acceptedAnswers)) {
    emit('success')
    emit('close')
  } else {
    error.value = '答案不正确，请重试'
    answer.value = ''
    await nextTick()
    inputRef.value?.focus()
  }
}
</script>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.auth-modal {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  padding: 32px;
  width: 380px;
  max-width: 90vw;
  box-shadow: 0 8px 40px rgba(0,0,0,0.3);
}
.auth-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  line-height: 1.5;
}
.auth-hint {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.auth-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.auth-input:focus {
  border-color: var(--vp-c-brand-1);
}
.auth-error {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--vp-c-danger-1);
}
.auth-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
.auth-btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.auth-btn-cancel {
  background: transparent;
  color: var(--vp-c-text-2);
  border-color: var(--vp-c-border);
}
.auth-btn-cancel:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-text-2);
}
.auth-btn-submit {
  background: var(--vp-c-brand-1);
  color: #fff;
}
.auth-btn-submit:hover {
  background: var(--vp-c-brand-2);
}
.auth-btn-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
