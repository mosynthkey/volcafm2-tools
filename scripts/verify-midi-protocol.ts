import assert from 'node:assert/strict'
import { createMidiMessageRouter } from '../src/midi/midiMessageRouter'
import { createCurrentVoiceDump, createCurrentVoiceRequest, createDeviceInquiry, createProgramRequest,
  decodeCurrentVoice, isCurrentVoiceDump, unpackProgramDump } from '../src/midi/volcaFm2Protocol'
import { loadProgramReferences, matchCurrentVoice } from '../src/midi/programLoader'

assert.deepEqual([...createDeviceInquiry()], [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7])
assert.deepEqual([...createProgramRequest(65)], [0xf0, 0x42, 0x30, 0, 1, 0x2f, 0x1e, 1, 0xf7])
assert.deepEqual([...createCurrentVoiceRequest()], [0xf0, 0x42, 0x30, 0, 1, 0x2f, 0x12, 0xf7])

const voice = Uint8Array.from({ length: 140 }, (_, index) => (index * 37) & 0xff)
const dump = createCurrentVoiceDump(voice)
assert.equal(isCurrentVoiceDump(dump), true)
assert.deepEqual(decodeCurrentVoice(dump), voice)

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

console.log('MIDI protocol and message router verification passed.')
