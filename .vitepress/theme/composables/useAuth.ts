import { ref, watch } from 'vue'

const STORAGE_KEY = 'floorball-auth'

export interface AuthState {
  authenticated: boolean
  timestamp: number
}

const state = ref<AuthState>({ authenticated: false, timestamp: 0 })

// Hydrate from localStorage (client-only, called below)
function hydrate() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed: AuthState = JSON.parse(saved)
      if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
        state.value = parsed
        return
      }
    }
  } catch {}
  localStorage.removeItem(STORAGE_KEY)
}

// Only hydrate in browser
if (typeof window !== 'undefined') {
  hydrate()
}

// Persist on change
watch(state, (v) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
  }
}, { deep: true })

export function useAuth() {
  function login(answer: string, acceptedAnswers: string[]): boolean {
    const normalized = answer.trim().toLowerCase()
    const valid = acceptedAnswers.some((a: string) => a.toLowerCase() === normalized)
    if (!valid) return false
    state.value = { authenticated: true, timestamp: Date.now() }
    return true
  }

  function logout() {
    state.value = { authenticated: false, timestamp: 0 }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return { authState: state, login, logout }
}
