import { PREVIEW_SAMPLE_RATE } from './previewConstants'
import { sortPreviewEvents, type PreviewEvent } from './previewEvents'

// C3, G3, C4, G4 — four long tones that stack from low to high.
const STACK_NOTES = [48, 55, 60, 67]
const STACK_STAGGER_FRAMES = Math.round(PREVIEW_SAMPLE_RATE * 0.45)
const STACK_HOLD_FRAMES = Math.round(PREVIEW_SAMPLE_RATE * 1.1)
const STACK_RELEASE_FRAMES = Math.round(PREVIEW_SAMPLE_RATE * 0.5)

export const phrasePreviewEvents = () => {
  const events: PreviewEvent[] = []
  STACK_NOTES.forEach((note, noteIndex) => {
    events.push({ frame: noteIndex * STACK_STAGGER_FRAMES, type: 'on', note, velocity: 100 })
  })
  const offFrame = (STACK_NOTES.length - 1) * STACK_STAGGER_FRAMES + STACK_HOLD_FRAMES
  STACK_NOTES.forEach(note => {
    events.push({ frame: offFrame, type: 'off', note })
  })
  return {
    events: sortPreviewEvents(events),
    frameCount: offFrame + STACK_RELEASE_FRAMES,
  }
}
