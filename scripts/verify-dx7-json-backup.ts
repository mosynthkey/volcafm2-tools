import assert from 'node:assert/strict'
import {
    DX7_PACKED_VOICE_SIZE,
    DX7_UNPACKED_VOICE_SIZE,
    buildDx7Cartridge,
    buildDx7SingleVoice,
    packDx7Voice,
    packedVoiceName,
    packedVoiceToVolcaProgram,
    parseDx7Sysex,
    unpackDx7Voice,
} from '../src/midi/dx7Cartridge'
import { decodeSoundProgram } from '../src/utils/soundProgramCodec'
import {
    SOUND_LIST_BACKUP_KIND,
    SOUND_LIST_SLOT_COUNT,
    bytesToHex,
    decodeSoundListBackup,
    encodeSoundListBackup,
    hexToBytes,
    mapImportedVoiceSlots,
    padPackedProgram,
    padProgramDump,
    remapSlotAfterReorder,
    sequenceSlotsAffectedByReorder,
} from '../src/utils/soundListBackup'
import { formatSequenceUsageList, formatSequenceUsagePill } from '../src/utils/sequenceUsage'

const writeName = (bytes: Uint8Array, offset: number, name: string) => {
    const padded = name.padEnd(10, ' ').slice(0, 10)
    for (let characterIndex = 0; characterIndex < 10; characterIndex++) {
        bytes[offset + characterIndex] = padded.charCodeAt(characterIndex)
    }
}

const makeUnpackedVoice = (name: string, algorithm: number) => {
    const unpacked = new Uint8Array(DX7_UNPACKED_VOICE_SIZE)
    unpacked[16] = 99
    unpacked[134] = algorithm
    unpacked[135] = 7
    unpacked[136] = 1
    unpacked[142] = 4
    unpacked[143] = 3
    unpacked[144] = 24
    writeName(unpacked, 145, name)
    return unpacked
}

const brass = makeUnpackedVoice('BRASS 1', 17)
const packedBrass = packDx7Voice(brass)
assert.equal(packedBrass.length, DX7_PACKED_VOICE_SIZE)
assert.equal(packedVoiceName(packedBrass), 'BRASS 1')
assert.equal(packedBrass[110] & 0x1f, 17)
assert.equal(packedBrass[111] & 0x07, 7)
assert.equal((packedBrass[111] >> 3) & 0x01, 1)
assert.deepEqual(unpackDx7Voice(packedBrass), brass)
assert.deepEqual(packDx7Voice(unpackDx7Voice(packedBrass)), packedBrass)

const format0 = buildDx7SingleVoice(brass)
const parsedSingle = parseDx7Sysex(format0)
assert.equal(parsedSingle.length, 1)
assert.equal(parsedSingle[0].name, 'BRASS 1')
assert.deepEqual(parsedSingle[0].packed, packedBrass)

const cartridgeVoices = Array.from({ length: 32 }, (_, voiceIndex) => {
    const packed = new Uint8Array(DX7_PACKED_VOICE_SIZE)
    packed.set(packedBrass)
    writeName(packed, 118, `V${String(voiceIndex).padStart(2, '0')}`)
    packed[110] = voiceIndex & 0x1f
    return packed
})
const format9 = buildDx7Cartridge(cartridgeVoices)
const parsedCartridge = parseDx7Sysex(format9)
assert.equal(parsedCartridge.length, 32)
assert.equal(parsedCartridge[0].name, 'V00')
assert.equal(parsedCartridge[31].name, 'V31')
assert.equal(parsedCartridge[9].packed[110] & 0x1f, 9)

const combined = new Uint8Array(format0.length + format9.length)
combined.set(format0)
combined.set(format9, format0.length)
assert.equal(parseDx7Sysex(combined).length, 33)

const volca = packedVoiceToVolcaProgram(packedBrass)
assert.equal(volca.length, 140)
assert.deepEqual(Array.from(volca.subarray(0, 128)), Array.from(packedBrass))
assert.deepEqual(Array.from(volca.subarray(128, 133)), [64, 64, 64, 64, 4])
assert.deepEqual(Array.from(volca.subarray(133, 139)), [1, 1, 1, 1, 1, 1])
const decoded = decodeSoundProgram(volca)
assert.equal(decoded.name, 'BRASS 1')
assert.equal(decoded.algorithm, 17)
assert.equal(decoded.modulatorAttack, 0)
assert.equal(decoded.octave, 0)
assert.equal(decoded.operators.every(operator => operator.enabled), true)

assert.deepEqual(mapImportedVoiceSlots(3, 62), [62, 63, 0])
assert.deepEqual(mapImportedVoiceSlots(2, 5), [5, 6])

const selectedIndexes = [0, 2]
const destinations = mapImportedVoiceSlots(selectedIndexes.length, 62)
const imported = Array.from({ length: SOUND_LIST_SLOT_COUNT }, () => padPackedProgram())
selectedIndexes.forEach((voiceIndex, mappedIndex) => {
    imported[destinations[mappedIndex]] = parsedCartridge[voiceIndex].packed
})
assert.equal(packedVoiceName(imported[62]), 'V00')
assert.equal(packedVoiceName(imported[63]), 'V02')
assert.equal(packedVoiceName(imported[0]), '')

const programs = Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, slot) => ({
    name: slot === 3 ? 'BRASS 1' : '',
    data: slot === 3 ? packedBrass : padPackedProgram(),
}))
const json = encodeSoundListBackup(programs)
const parsedJson = JSON.parse(json) as { version: number; kind: string; programs: unknown[] }
assert.equal(parsedJson.version, 1)
assert.equal(parsedJson.kind, SOUND_LIST_BACKUP_KIND)
assert.equal(parsedJson.programs.length, 64)
const restored = decodeSoundListBackup(json)
assert.equal(restored[3].name, 'BRASS 1')
assert.equal(restored[3].data.length, 140)
assert.deepEqual(restored[3].data.subarray(0, 128), packedBrass)
assert.equal(restored[0].data.length, 140)
assert.deepEqual(decodeSoundListBackup(encodeSoundListBackup(restored)), restored)

const hex140 = bytesToHex(volca)
assert.equal(hexToBytes(hex140).length, 140)
const backup140 = JSON.stringify({
    version: 1,
    kind: SOUND_LIST_BACKUP_KIND,
    programs: Array.from({ length: 64 }, (_, slot) => ({
        slot,
        name: slot === 1 ? 'BRASS 1' : '',
        data: slot === 1 ? hex140 : bytesToHex(padPackedProgram()),
    })),
})
const restored140 = decodeSoundListBackup(backup140)
assert.equal(restored140[1].data.length, 140)
assert.deepEqual(restored140[1].data, volca)

assert.equal(padProgramDump(packedBrass).length, 140)
assert.equal(remapSlotAfterReorder(5, 5, 10), 10)
assert.equal(remapSlotAfterReorder(8, 5, 10), 7)
assert.equal(remapSlotAfterReorder(8, 10, 5), 9)
assert.equal(remapSlotAfterReorder(2, 5, 10), 2)
assert.equal(remapSlotAfterReorder(null, 5, 10), null)

assert.deepEqual(sequenceSlotsAffectedByReorder([5, 8, 2], 5, 10), [0, 1])
assert.deepEqual(sequenceSlotsAffectedByReorder([2, null, 11], 5, 10), [])
assert.equal(formatSequenceUsagePill([1]), '(Seq 1)')
assert.equal(formatSequenceUsagePill([1, 2, 3, 8]), '(Seq 1–3, 8)')
assert.equal(formatSequenceUsageList([1, 4]), 'Seq 1, Seq 4')

console.log('DX7 SysEx parse, selected-voice mapping, and JSON backup verification passed.')
