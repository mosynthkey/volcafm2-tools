import { MOTION_PARAM_KEYS } from '../types/sequence'

export type MotionParamKey = (typeof MOTION_PARAM_KEYS)[number]

const ARP_TYPE_LABELS = ['Off', 'R1', 'R2', 'R3', 'F1', 'F2', 'F3', 'N1', 'N2', 'N3']
const ARP_DIV_LABELS = ['1/12', '1/8', '1/4', '1/3', '1/2', '2/3', '1/1', '3/2', '2/1', '3/1', '4/1']

const clampMidi = (value: number) => Math.max(0, Math.min(127, Math.round(value)))
const clampInt = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)))

/** Firmware numericUtility::fastMap(in, 7, outMax) */
const fastMap7 = (midi: number, outMax: number) => (clampMidi(midi) * (outMax + 1)) >> 7

const invertFastMap7 = (display: number, outMax: number) => {
  const target = clampInt(display, 0, outMax)
  const matches: number[] = []
  for (let midi = 0; midi <= 127; midi++) {
    if (fastMap7(midi, outMax) === target) matches.push(midi)
  }
  return matches[Math.floor((matches.length - 1) / 2)] ?? 0
}

const invertLookup = (read: (midi: number) => number, display: number) => {
  const matches: number[] = []
  let best = 64
  let bestDist = Infinity
  for (let midi = 0; midi <= 127; midi++) {
    const value = read(midi)
    if (value === display) matches.push(midi)
    const dist = Math.abs(value - display)
    if (dist < bestDist) {
      bestDist = dist
      best = midi
    }
  }
  return matches.length ? matches[Math.floor((matches.length - 1) / 2)] : best
}

/** Firmware getTranposeNote() when FUNC Trnsps Note is on, in semitones. */
export const transposeNoteFromMidi = (midi: number) => {
  let trans = clampMidi(midi)
  if (trans < 61) {
    if (trans) trans -= 1
    trans = 59 - trans
    trans = Math.floor((trans * 36) / 60)
    return -1 - trans
  }
  if (trans < 68) return 0
  trans -= 68
  trans = Math.floor((trans * 36) / 60)
  return trans + 1
}

/** Firmware getTranposeNote() when FUNC Trnsps Note is off, in octaves. */
export const transposeOctaveFromMidi = (midi: number) => {
  let trans = clampMidi(midi)
  if (trans < 55) {
    if (trans) trans -= 1
    return Math.floor(trans / 18) - 3
  }
  if (trans < 74) return 0
  trans -= 74
  return Math.floor(trans / 18) + 1
}

const paramKey = (paramIndex: number): MotionParamKey => MOTION_PARAM_KEYS[paramIndex] ?? 'velocity'

export const getMotionDisplayRange = (paramIndex: number, transposeNote: boolean) => {
  switch (paramKey(paramIndex)) {
    case 'transpose': return transposeNote ? { min: -36, max: 36 } : { min: -3, max: 3 }
    case 'velocity': return { min: 1, max: 127 }
    case 'algorithm': return { min: 1, max: 32 }
    case 'modulatorAttack':
    case 'modulatorDecay':
    case 'carrierAttack':
    case 'carrierDecay': return { min: -63, max: 63 }
    case 'lfoRate':
    case 'lfoPitchDepth': return { min: 0, max: 99 }
    case 'arpType': return { min: 0, max: 9 }
    case 'arpDivision': return { min: 0, max: 10 }
    default: return { min: 0, max: 127 }
  }
}

export const midiToDisplay = (paramIndex: number, midi: number, transposeNote: boolean) => {
  const value = clampMidi(midi)
  switch (paramKey(paramIndex)) {
    case 'transpose': return transposeNote ? transposeNoteFromMidi(value) : transposeOctaveFromMidi(value)
    case 'velocity': return Math.max(1, value)
    case 'algorithm': return fastMap7(value, 31) + 1
    case 'modulatorAttack':
    case 'modulatorDecay':
    case 'carrierAttack':
    case 'carrierDecay': return value - 64
    case 'lfoRate':
    case 'lfoPitchDepth': return fastMap7(value, 99)
    case 'arpType': return fastMap7(value, 9)
    case 'arpDivision': return fastMap7(value, 10)
    default: return value
  }
}

export const displayToMidi = (paramIndex: number, display: number, transposeNote: boolean) => {
  const range = getMotionDisplayRange(paramIndex, transposeNote)
  const value = clampInt(display, range.min, range.max)
  switch (paramKey(paramIndex)) {
    case 'transpose': return invertLookup(
      midi => (transposeNote ? transposeNoteFromMidi(midi) : transposeOctaveFromMidi(midi)),
      value,
    )
    case 'velocity': return clampInt(value, 1, 127)
    case 'algorithm': return invertFastMap7(value - 1, 31)
    case 'modulatorAttack':
    case 'modulatorDecay':
    case 'carrierAttack':
    case 'carrierDecay': return clampMidi(value + 64)
    case 'lfoRate':
    case 'lfoPitchDepth': return invertFastMap7(value, 99)
    case 'arpType': return invertFastMap7(value, 9)
    case 'arpDivision': return invertFastMap7(value, 10)
    default: return clampMidi(value)
  }
}

const signedLabel = (value: number) => (value > 0 ? `+${value}` : String(value))

export const formatMotionValue = (paramIndex: number, midi: number, transposeNote: boolean) => {
  const display = midiToDisplay(paramIndex, midi, transposeNote)
  switch (paramKey(paramIndex)) {
    case 'transpose':
    case 'modulatorAttack':
    case 'modulatorDecay':
    case 'carrierAttack':
    case 'carrierDecay': return signedLabel(display)
    case 'arpType': return ARP_TYPE_LABELS[display] ?? String(display)
    case 'arpDivision': return ARP_DIV_LABELS[display] ?? String(display)
    default: return String(display)
  }
}
