import { unpackDx7Voice } from '../midi/dx7Cartridge'
import type { SoundProgram } from '../types/soundProgram'
import { encodeSoundProgram } from './soundProgramCodec'

export type PreviewVoice = {
  unpacked: Uint8Array
  opSwitch: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isPreviewVoice = (value: unknown): value is PreviewVoice =>
  isRecord(value) && value.unpacked instanceof Uint8Array && typeof value.opSwitch === 'string'

export const isSoundProgram = (value: unknown): value is SoundProgram =>
  isRecord(value) && Array.isArray(value.operators) && value.operators.length === 6

const opSwitchFromFlags = (flags: ArrayLike<number | boolean>) =>
  Array.from({ length: 6 }, (_, operatorIndex) => (flags[operatorIndex] ? '1' : '0')).join('')

export const previewVoiceFromPacked = (packed: Uint8Array, opSwitch = '111111'): PreviewVoice => ({
  unpacked: unpackDx7Voice(packed.subarray(0, 128)),
  opSwitch,
})

export const previewVoiceFromDump = (dump: Uint8Array): PreviewVoice => {
  const packed = dump.subarray(0, 128)
  if (dump.length >= 140) {
    return previewVoiceFromPacked(packed, opSwitchFromFlags(dump.subarray(133, 139)))
  }
  return previewVoiceFromPacked(packed)
}

export const previewVoiceFromProgram = (program: SoundProgram): PreviewVoice => {
  const dump = encodeSoundProgram(program)
  return previewVoiceFromDump(dump)
}

export const previewVoiceFromUnknown = (value: unknown): PreviewVoice | null => {
  if (isSoundProgram(value)) return previewVoiceFromProgram(value)
  if (value instanceof Uint8Array) return previewVoiceFromDump(value)
  return null
}
