import assert from 'node:assert/strict'
import { encodeSoundProgram, createInitialSoundProgram } from '../src/utils/soundProgramCodec'
import {
    SOUND_LIST_BACKUP_KIND,
    SOUND_LIST_SLOT_COUNT,
    bytesToHex,
    padProgramDump,
} from '../src/utils/soundListBackup'
import {
    decodeLibraryFile,
    encodeLibraryFile,
    extensionForKind,
    kindFromExtension,
    libraryFilename,
    serializeSoundList,
    deserializeSoundList,
} from '../src/utils/libraryFormat'

assert.equal(extensionForKind('sound'), 'vfm2_sound')
assert.equal(extensionForKind('sequence'), 'vfm2_seq')
assert.equal(extensionForKind('sound-list'), 'vfm2_list')
assert.equal(extensionForKind('bundle'), 'vfm2_bundle')
assert.equal(kindFromExtension('Lead.vfm2_sound'), 'sound')
assert.equal(kindFromExtension('groove.VFM2_SEQ'), 'sequence')
assert.equal(kindFromExtension('bank.vfm2_list'), 'sound-list')
assert.equal(kindFromExtension('all.vfm2_bundle'), 'bundle')
assert.equal(libraryFilename('My Voice', 'sound'), 'My Voice.vfm2_sound')

const sound = createInitialSoundProgram()
sound.name = 'BRASS 1'
const soundFile = encodeLibraryFile('sound', 'Brass', { sound })
const decodedSound = decodeLibraryFile(soundFile, 'Brass.vfm2_sound')
assert.equal(decodedSound.kind, 'sound')
assert.equal(decodedSound.name, 'Brass')
assert.equal((decodedSound.payload.sound as { name: string }).name, 'BRASS 1')
assert.equal(encodeSoundProgram(decodedSound.payload.sound as Parameters<typeof encodeSoundProgram>[0]).length, 140)

const sequence = { programNo: 3, notes: [], velocity: 100 }
const seqFile = encodeLibraryFile('sequence', 'Groove', { sequence })
const decodedSeq = decodeLibraryFile(seqFile, 'Groove.vfm2_seq')
assert.equal(decodedSeq.kind, 'sequence')
assert.equal((decodedSeq.payload.sequence as { programNo: number }).programNo, 3)

const programs = Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, slot) => ({
    name: slot === 2 ? 'BRASS 1' : '',
    data: padProgramDump(encodeSoundProgram(sound)),
}))
const listPayload = { soundList: serializeSoundList(programs) }
const listFile = encodeLibraryFile('sound-list', 'Bank A', listPayload)
const decodedList = decodeLibraryFile(listFile, 'Bank A.vfm2_list')
assert.equal(decodedList.kind, 'sound-list')
const restoredList = deserializeSoundList(decodedList.payload.soundList ?? [])
assert.equal(restoredList[2].name, 'BRASS 1')
assert.equal(restoredList[2].data.length, 140)

const oldBackup = JSON.stringify({
    version: 1,
    kind: SOUND_LIST_BACKUP_KIND,
    programs: Array.from({ length: 64 }, (_, slot) => ({
        slot,
        name: slot === 1 ? 'BRASS 1' : '',
        data: bytesToHex(padProgramDump()),
    })),
})
const decodedOld = decodeLibraryFile(oldBackup, 'volca_fm2_sound_list.json')
assert.equal(decodedOld.kind, 'sound-list')
assert.equal(deserializeSoundList(decodedOld.payload.soundList ?? [])[1].name, 'BRASS 1')

const bundleFile = encodeLibraryFile('bundle', 'Session', {
    sound,
    sequence,
    soundList: serializeSoundList(programs),
})
const decodedBundle = decodeLibraryFile(bundleFile, 'Session.vfm2_bundle')
assert.equal(decodedBundle.kind, 'bundle')
assert.ok(decodedBundle.payload.sound)
assert.ok(decodedBundle.payload.sequence)
assert.equal(decodedBundle.payload.soundList?.length, 64)

console.log('Library file format verification passed.')
