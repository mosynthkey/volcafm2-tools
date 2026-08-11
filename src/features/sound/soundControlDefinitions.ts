import type { SoundOperator, SoundProgram } from '@/types/soundProgram'

export type OperatorNumberKey = { [K in keyof SoundOperator]: SoundOperator[K] extends number ? K : never }[keyof SoundOperator]
export type ProgramNumberKey = { [K in keyof SoundProgram]: SoundProgram[K] extends number ? K : never }[keyof SoundProgram]
export type NumberControlDefinition<K extends string> = { key: K; label: string; min: number; max: number; displayOffset?: number }

export const operatorFrequencyControls: NumberControlDefinition<OperatorNumberKey>[] = [
  { key: 'detune', label: 'sound.detune', min: 0, max: 14, displayOffset: -7 },
  { key: 'coarse', label: 'sound.coarse', min: 0, max: 31 }, { key: 'fine', label: 'sound.fine', min: 0, max: 99 },
  { key: 'outputLevel', label: 'sound.outputLevel', min: 0, max: 99 },
  { key: 'ampModSensitivity', label: 'sound.ampModSens', min: 0, max: 3 }, { key: 'keyVelocitySensitivity', label: 'sound.keyVelocity', min: 0, max: 7 },
]

export const macroControls: NumberControlDefinition<ProgramNumberKey>[] = [
  { key: 'modulatorAttack', label: 'sound.modAttack', min: -63, max: 63 }, { key: 'modulatorDecay', label: 'sound.modDecay', min: -63, max: 63 },
  { key: 'carrierAttack', label: 'sound.carrierAttack', min: -63, max: 63 }, { key: 'carrierDecay', label: 'sound.carrierDecay', min: -63, max: 63 },
]

export const lfoControls: NumberControlDefinition<ProgramNumberKey>[] = [
  { key: 'lfoSpeed', label: 'sound.speed', min: 0, max: 99 }, { key: 'lfoDelay', label: 'sound.delay', min: 0, max: 99 },
  { key: 'pitchModDepth', label: 'sound.pitchModDepth', min: 0, max: 99 }, { key: 'ampModDepth', label: 'sound.ampModDepth', min: 0, max: 99 },
  { key: 'pitchModSensitivity', label: 'sound.pitchModSens', min: 0, max: 7 },
]
