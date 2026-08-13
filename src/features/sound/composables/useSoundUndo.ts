import { onMounted, onUnmounted } from 'vue'
import { useSoundStore } from '@/stores/soundStore'
import { useUiStore } from '@/stores/uiStore'

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export const useSoundUndo = () => {
  const sound = useSoundStore()
  const ui = useUiStore()

  const onKeydown = (event: KeyboardEvent) => {
    if (ui.activeTab !== 'sound-edit') return
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    if (event.key.toLowerCase() !== 'z') return
    if (isEditableTarget(event.target)) return
    event.preventDefault()
    if (event.shiftKey) sound.redo()
    else sound.undo()
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
