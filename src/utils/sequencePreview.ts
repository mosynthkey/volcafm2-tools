import { midiToDisplay } from './motionValue'
import { PREVIEW_SAMPLE_RATE } from './previewConstants'
import { sortPreviewEvents, type PreviewEvent } from './previewEvents'
import type { PreviewVoice } from './programPreviewVoice'
import { decodeSoundProgram } from './soundProgramCodec'
import {
  MOTION_PARAM_KEYS,
  NUM_OF_VOICES_PER_STEP,
  normalizeSequenceState,
  type SequenceState,
} from '../types/sequence'

export const SEQUENCE_PREVIEW_BPM = 120

const TEMPO_MULTIPLIER = [1, 2, 4]
const RELEASE_FRAMES = Math.round(PREVIEW_SAMPLE_RATE * 0.35)
const MOTION_ALGORITHM = MOTION_PARAM_KEYS.indexOf('algorithm')
const MOTION_TRANSPOSE = MOTION_PARAM_KEYS.indexOf('transpose')
const MOTION_VELOCITY = MOTION_PARAM_KEYS.indexOf('velocity')
const MOTION_LFO_RATE = MOTION_PARAM_KEYS.indexOf('lfoRate')
const MOTION_LFO_PITCH = MOTION_PARAM_KEYS.indexOf('lfoPitchDepth')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isSequenceState = (value: unknown): value is SequenceState =>
  isRecord(value) && Array.isArray(value.notes) && Array.isArray(value.activeStep) && isRecord(value.func)

export type SequencePreviewRequest = {
  sequence: SequenceState
  voice?: unknown
}

export const isSequencePreviewRequest = (value: unknown): value is SequencePreviewRequest =>
  isRecord(value) && isSequenceState(value.sequence)

const sixteenthSec = (tempo: number) =>
  (60 / SEQUENCE_PREVIEW_BPM / 4) * (TEMPO_MULTIPLIER[tempo] ?? 1)

const motionMidi = (state: SequenceState, paramIndex: number, step: number) => {
  if (!state.func.motionOn) return null
  if (!state.motionEnabled[paramIndex]) return null
  if (!state.motionStepEnabled[paramIndex]?.[step]) return null
  return state.motionValues[paramIndex]?.[step]?.[0] ?? null
}

const octaveFromVoice = (source: unknown) => {
  if (isRecord(source) && typeof source.octave === 'number') return source.octave
  if (source instanceof Uint8Array && source.length >= 140) return decodeSoundProgram(source).octave
  return 0
}

const activeStepsOf = (state: SequenceState) => {
  const steps = state.activeStep
    .map((on, step) => (on ? step : -1))
    .filter(step => step >= 0)
  return steps.length > 0 ? steps : [0]
}

const playStepDurationSec = (state: SequenceState, activeCount: number) => {
  const sixteenth = sixteenthSec(state.func.tempo)
  if (state.func.warpActiveStep) return (16 * sixteenth) / activeCount
  return sixteenth
}

const framesOf = (seconds: number) => Math.max(0, Math.round(seconds * PREVIEW_SAMPLE_RATE))

const clampNote = (note: number) => Math.max(0, Math.min(127, Math.round(note)))

const applyMotionPatch = (base: Uint8Array, state: SequenceState, step: number) => {
  const next = new Uint8Array(base)
  let changed = false
  const algorithmMidi = motionMidi(state, MOTION_ALGORITHM, step)
  if (algorithmMidi !== null) {
    next[134] = midiToDisplay(MOTION_ALGORITHM, algorithmMidi, state.func.transposeNote) - 1
    changed = true
  }
  const lfoRateMidi = motionMidi(state, MOTION_LFO_RATE, step)
  if (lfoRateMidi !== null) {
    next[137] = midiToDisplay(MOTION_LFO_RATE, lfoRateMidi, state.func.transposeNote)
    changed = true
  }
  const lfoPitchMidi = motionMidi(state, MOTION_LFO_PITCH, step)
  if (lfoPitchMidi !== null) {
    next[139] = midiToDisplay(MOTION_LFO_PITCH, lfoPitchMidi, state.func.transposeNote)
    changed = true
  }
  return changed ? next : null
}

const pitchForStep = (state: SequenceState, pitch: number, step: number, octave: number) => {
  let note = pitch + octave * 12
  const transposeMidi = motionMidi(state, MOTION_TRANSPOSE, step)
  if (transposeMidi !== null) {
    const amount = midiToDisplay(MOTION_TRANSPOSE, transposeMidi, state.func.transposeNote)
    note += state.func.transposeNote ? amount : amount * 12
  }
  return clampNote(note)
}

const velocityForStep = (state: SequenceState, velocity: number, step: number) => {
  const velocityMidi = motionMidi(state, MOTION_VELOCITY, step)
  if (velocityMidi === null) return Math.max(1, Math.min(127, velocity))
  return Math.max(1, Math.min(127, midiToDisplay(MOTION_VELOCITY, velocityMidi, state.func.transposeNote)))
}

export const sequencePreviewEvents = (
  raw: SequenceState,
  voice: PreviewVoice,
  source?: unknown,
) => {
  const state = normalizeSequenceState(raw)
  const activeSteps = activeStepsOf(state)
  const stepDuration = playStepDurationSec(state, activeSteps.length)
  const playIndexByStep = new Map(activeSteps.map((step, playIndex) => [step, playIndex]))
  const octave = octaveFromVoice(source)
  const events: PreviewEvent[] = []
  let held: number[] = []

  activeSteps.forEach((step, playIndex) => {
    const startFrame = framesOf(playIndex * stepDuration)
    const patch = applyMotionPatch(voice.unpacked, state, step)
    if (patch) events.push({ frame: startFrame, type: 'patch', unpacked: patch })

    const starts = state.notes
      .filter(note => note.startStep === step && state.stepOn[step])
      .slice(0, NUM_OF_VOICES_PER_STEP)

    if (state.func.voiceMono && starts.length > 0) {
      held.forEach(note => events.push({ frame: startFrame, type: 'off', note }))
      held = []
    }

    starts.forEach(note => {
      const midiNote = pitchForStep(state, note.pitch, step, octave)
      const covered = activeSteps.filter(active => active >= note.startStep && active < note.startStep + note.length)
      if (covered.length === 0) return
      const lastPlayIndex = playIndexByStep.get(covered[covered.length - 1]) ?? playIndex
      const endFrame = framesOf(lastPlayIndex * stepDuration + stepDuration * (note.gatePercent / 100))
      events.push({
        frame: startFrame,
        type: 'on',
        note: midiNote,
        velocity: velocityForStep(state, note.velocity, step),
      })
      events.push({ frame: Math.max(startFrame + 1, endFrame), type: 'off', note: midiNote })
      if (state.func.voiceMono) held = [midiNote]
    })
  })

  const lastFrame = events.reduce((max, event) => Math.max(max, event.frame), 0)
  const loopFrames = framesOf(activeSteps.length * stepDuration)
  return {
    events: sortPreviewEvents(events),
    frameCount: Math.max(loopFrames, lastFrame) + RELEASE_FRAMES,
  }
}
