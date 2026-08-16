import assert from 'node:assert/strict'
import { createMidiMessageRouter } from '../src/midi/midiMessageRouter'
import { createSysexAssembler } from '../src/midi/sysexAssembler'
import { buildDx7Cartridge } from '../src/midi/dx7Cartridge'
import { createCurrentSequenceRequest, createCurrentVoiceDump, createCurrentVoiceRequest, createDeviceInquiry, createProgramDump, createProgramRequest,
  decodeCurrentSequence, decodeCurrentVoice, decodeProgramDump, isCurrentSequenceDump, isCurrentVoiceDump, isProgramDump, unpackProgramDump } from '../src/midi/volcaFm2Protocol'
import { encodeCurrentSequenceDump } from '../src/utils/sequenceCodec'
import { createEmptySequenceState } from '../src/types/sequence'
import { loadProgramReferences, matchCurrentVoice } from '../src/midi/programLoader'

assert.deepEqual([...createDeviceInquiry()], [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7])
assert.deepEqual([...createProgramRequest(65)], [0xf0, 0x42, 0x30, 0, 1, 0x2f, 0x1e, 1, 0xf7])
assert.deepEqual([...createCurrentVoiceRequest()], [0xf0, 0x42, 0x30, 0, 1, 0x2f, 0x12, 0xf7])
assert.deepEqual([...createCurrentSequenceRequest()], [0xf0, 0x42, 0x30, 0, 1, 0x2f, 0x10, 0xf7])

const voice = Uint8Array.from({ length: 140 }, (_, index) => (index * 37) & 0xff)
const dump = createCurrentVoiceDump(voice)
assert.equal(isCurrentVoiceDump(dump), true)
assert.deepEqual(decodeCurrentVoice(dump), voice)

const programDump = createProgramDump(65, voice)
assert.equal(isProgramDump(programDump), true)
assert.equal(programDump[7], 1)
assert.deepEqual(decodeProgramDump(programDump), voice)

const packedProgram: number[] = []
for (let offset = 0; offset < 128; offset += 7) {
  const values = [...voice.slice(offset, Math.min(offset + 7, 128))]
  let header = 0
  values.forEach((value, bit) => { header |= ((value >> 7) & 1) << bit })
  packedProgram.push(header, ...values.map(value => value & 0x7f))
}
assert.deepEqual(unpackProgramDump(new Uint8Array(packedProgram)), voice.slice(0, 128))

const router = createMidiMessageRouter(); const events: string[] = []
router.onNote((note, on, velocity) => events.push(`note:${note}:${on}:${velocity}`))
router.onProgramChange(program => events.push(`program:${program}`))
router.publishChannel(new Uint8Array([0x90, 60, 100])); router.publishChannel(new Uint8Array([0x90, 60, 0])); router.publishChannel(new Uint8Array([0xc0, 12]))
assert.deepEqual(events, ['note:60:true:100', 'note:60:false:0', 'program:12'])

const programs = Array.from({ length: 64 }, (_, index) => index === 9 ? voice.slice(0, 128) : new Uint8Array(128))
const names = Array.from({ length: 64 }, (_, index) => ({ name: index === 9 ? 'MATCH' : '' }))
voice.set(new TextEncoder().encode('MATCH     '), 118)
programs[9] = voice.slice(0, 128)
assert.equal(matchCurrentVoice(voice.slice(0, 128), programs, names).programNo, 9)

const received = new Set<number>([0]); const requests: number[] = []
const missing = await loadProgramReferences({ hasProgram: program => received.has(program), request: program => { requests.push(program); received.add(program) }, waitFor: async program => received.has(program), log: () => {} })
assert.deepEqual(missing, []); assert.equal(requests.length, 63)

const assembler = createSysexAssembler()
assert.equal(assembler.isChannelMessage(new Uint8Array([0x90, 60, 100])), true)
const first = assembler.push(new Uint8Array([0xf0, 0x42, 0x30]))
const second = assembler.push(new Uint8Array([0x00, 0xf8, 0x01, 0xf7]))
assert.deepEqual([...first], [])
assert.deepEqual([...second[0]], [0xf0, 0x42, 0x30, 0x00, 0x01, 0xf7])

const cartridge = buildDx7Cartridge([new Uint8Array([1, 2]), new Uint8Array([3])])
assert.deepEqual([...cartridge.slice(0, 6)], [0xf0, 0x43, 0x00, 0x09, 0x20, 0x00])
assert.equal(cartridge[cartridge.length - 1], 0xf7)
assert.equal(cartridge[cartridge.length - 2], (0x100 - (1 + 2 + 3)) & 0x7f)

const sequenceDump = encodeCurrentSequenceDump(createEmptySequenceState())
assert.equal(isCurrentSequenceDump(sequenceDump), true)
assert.equal(decodeCurrentSequence(sequenceDump).length, 1920)

console.log('MIDI protocol and message router verification passed.')
