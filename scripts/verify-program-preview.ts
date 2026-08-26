import assert from 'node:assert/strict'
import { createInitialSoundProgram, encodeSoundProgram } from '../src/utils/soundProgramCodec'
import { previewVoiceFromDump, previewVoiceFromProgram } from '../src/utils/programPreviewVoice'
import { phrasePreviewEvents } from '../src/utils/previewPhrase'
import { PREVIEW_SAMPLE_RATE } from '../src/utils/previewConstants'
import { sequencePreviewEvents } from '../src/utils/sequencePreview'
import { createEmptySequenceState, createSequenceNote } from '../src/types/sequence'
import { displayToMidi } from '../src/utils/motionValue'

const program = createInitialSoundProgram()
program.operators[5].enabled = false
const fromProgram = previewVoiceFromProgram(program)
assert.equal(fromProgram.unpacked.length, 155)
assert.equal(fromProgram.opSwitch, '011111')
assert.equal(fromProgram.unpacked[134], program.algorithm)

const encoded = encodeSoundProgram(program)
const fromDump = previewVoiceFromDump(encoded)
assert.equal(fromDump.opSwitch, '011111')
assert.equal(fromDump.unpacked[134], encoded[110] & 0x1f)

const phrase = phrasePreviewEvents()
const phraseOns = phrase.events.filter(event => event.type === 'on')
const phraseOffs = phrase.events.filter(event => event.type === 'off')
assert.equal(phraseOns.length, 4)
assert.equal(phraseOffs.length, 4)
assert.ok(phraseOns.every((event, noteIndex) => noteIndex === 0 || event.frame > phraseOns[noteIndex - 1].frame))
assert.ok(phraseOns.every(event => event.frame < phraseOffs[0].frame))
assert.ok(phraseOffs.every(event => event.frame === phraseOffs[0].frame))

const sequence = createEmptySequenceState()
sequence.notes = [createSequenceNote(60, 0, 1, 100, 100)]
const voice = previewVoiceFromProgram(createInitialSoundProgram())
const rendered = sequencePreviewEvents(sequence, voice)
const sequenceOns = rendered.events.filter(event => event.type === 'on')
assert.equal(sequenceOns.length, 1)
if (sequenceOns[0].type === 'on') assert.equal(sequenceOns[0].note, 60)
assert.equal(sequenceOns[0].frame, 0)
const expectedStep = Math.round((60 / 120 / 4) * PREVIEW_SAMPLE_RATE)
const sequenceOff = rendered.events.find(event => event.type === 'off')
assert.ok(sequenceOff)
assert.equal(sequenceOff?.frame, expectedStep)

sequence.activeStep = sequence.activeStep.map((_, step) => step % 2 === 0)
sequence.notes = [createSequenceNote(64, 1, 1, 100, 100), createSequenceNote(67, 2, 1, 100, 100)]
const skipped = sequencePreviewEvents(sequence, voice)
const skippedOns = skipped.events.filter(event => event.type === 'on')
assert.equal(skippedOns.length, 1)
if (skippedOns[0].type === 'on') assert.equal(skippedOns[0].note, 67)

sequence.activeStep = Array.from({ length: 16 }, (_, step) => step < 8)
sequence.func.warpActiveStep = true
sequence.notes = [createSequenceNote(72, 0, 1, 100, 100)]
const warped = sequencePreviewEvents(sequence, voice)
const warpedOff = warped.events.find(event => event.type === 'off')
const fullBar = Math.round((16 * (60 / 120 / 4)) * PREVIEW_SAMPLE_RATE)
assert.ok(warpedOff)
assert.equal(warpedOff?.frame, Math.round(fullBar / 8))

sequence.func.warpActiveStep = false
sequence.activeStep = Array.from({ length: 16 }, () => true)
sequence.func.motionOn = true
sequence.motionEnabled[0] = true
sequence.func.transposeNote = true
sequence.motionValues[0][0][0] = displayToMidi(0, 12, true)
sequence.notes = [createSequenceNote(48, 0, 1, 100, 100)]
const transposed = sequencePreviewEvents(sequence, voice)
const transposedOn = transposed.events.find(event => event.type === 'on')
assert.ok(transposedOn && transposedOn.type === 'on')
assert.equal(transposedOn.note, 60)

console.log('program preview voice conversion: OK')
console.log('program preview phrase stacking: OK')
console.log('sequence preview timing: OK')
