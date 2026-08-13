import { ref, watch } from 'vue'

export const usePersistedFlag = (key: string, fallback = false) => {
  const read = () => {
    try {
      const stored = localStorage.getItem(key)
      if (stored === '1') return true
      if (stored === '0') return false
    } catch {
      /* ignore quota / private mode */
    }
    return fallback
  }
  const value = ref(read())
  watch(value, next => {
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  })
  return value
}
