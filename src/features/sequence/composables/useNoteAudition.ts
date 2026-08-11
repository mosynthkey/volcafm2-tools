import { onUnmounted } from 'vue'
import type { useMidiStore } from '@/stores/midiStore'
import type { useSequencerStore } from '@/stores/sequencerStore'

type MidiStore = ReturnType<typeof useMidiStore>
type SequencerStore = ReturnType<typeof useSequencerStore>

export function useNoteAudition(midi: MidiStore, sequence: SequencerStore) {
  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  const stop = (pitch: number) => {
    const timer = timers.get(pitch)
    if (timer) clearTimeout(timer)
    timers.delete(pitch)
    midi.sendMidiMessage(new Uint8Array([0x80, pitch, 0]))
  }

  const audition = (pitches: number[], duration = 320) => {
    const velocity = Math.max(1, Math.min(127, Math.round(sequence.velocity)))
    for (const pitch of new Set(pitches)) {
      if (timers.has(pitch)) stop(pitch)
      midi.sendMidiMessage(new Uint8Array([0x90, pitch, velocity]))
      timers.set(pitch, setTimeout(() => stop(pitch), duration))
    }
  }

  onUnmounted(() => [...timers.keys()].forEach(stop))
  return { audition }
}

