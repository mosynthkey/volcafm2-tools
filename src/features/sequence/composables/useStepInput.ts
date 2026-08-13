import { onMounted, onUnmounted } from 'vue'
import { useMidiStore } from '@/stores/midiStore'
import { useSequencerStore } from '@/stores/sequencerStore'

export function useStepInput() {
  const midi = useMidiStore()
  const sequence = useSequencerStore()
  let unsubscribe: (() => void) | null = null
  onMounted(() => { unsubscribe = midi.onNoteEvent(sequence.handleStepNote) })
  onUnmounted(() => unsubscribe?.())
}
