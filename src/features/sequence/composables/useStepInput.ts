import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { useMidiStore } from '@/stores/midiStore'
import type { useSequencerStore } from '@/stores/sequencerStore'

type MidiStore = ReturnType<typeof useMidiStore>
type SequencerStore = ReturnType<typeof useSequencerStore>

export function useStepInput(midi: MidiStore, sequence: SequencerStore, sendSequence: () => void) {
  const active = ref(false)
  const cursor = ref(0)
  const heldNotes = ref(new Set<number>())
  const chordBuffer = ref(new Set<number>())
  const canInsertTie = computed(() => cursor.value > 0 && sequence.stepNoteCount(cursor.value - 1) > 0)
  let unsubscribe: (() => void) | null = null

  const finish = () => {
    active.value = false
    heldNotes.value.clear()
    chordBuffer.value.clear()
    sendSequence()
  }

  const next = () => cursor.value === 15 ? finish() : cursor.value++
  const commitChord = () => {
    for (const pitch of chordBuffer.value) sequence.addNote(pitch, cursor.value, 1)
    chordBuffer.value.clear()
    next()
  }
  const handleNote = (note: number, on: boolean) => {
    if (!active.value) return
    if (on) {
      heldNotes.value.add(note)
      chordBuffer.value.add(note)
      return
    }
    heldNotes.value.delete(note)
    if (heldNotes.value.size === 0 && chordBuffer.value.size > 0) commitChord()
  }
  const toggle = () => {
    active.value = !active.value
    if (active.value) cursor.value = 0
    heldNotes.value.clear()
    chordBuffer.value.clear()
  }
  const insertRest = () => {
    heldNotes.value.clear(); chordBuffer.value.clear()
    sequence.insertRest(cursor.value); next()
  }
  const insertTie = () => {
    heldNotes.value.clear(); chordBuffer.value.clear()
    if (sequence.insertTie(cursor.value)) next()
  }
  const select = (step: number) => {
    if (!active.value) return
    heldNotes.value.clear(); chordBuffer.value.clear()
    cursor.value = Math.max(0, Math.min(15, step))
  }

  onMounted(() => { unsubscribe = midi.onNoteEvent(handleNote) })
  onUnmounted(() => unsubscribe?.())
  return { active, cursor, chordBuffer, canInsertTie, toggle, next, insertRest, insertTie, select }
}

