import assert from 'node:assert/strict'
import { encodeSoundProgram, createInitialSoundProgram } from '../src/utils/soundProgramCodec'
import {
    SOUND_LIST_BACKUP_KIND,
    SOUND_LIST_SLOT_COUNT,
    bytesToHex,
    padProgramDump,
} from '../src/utils/soundListBackup'
import { NUM_OF_SEQUENCES, createEmptySequenceState } from '../src/types/sequence'
import {
    catalogItemsFromPayload,
    decodeLibraryFile,
    encodeLibraryFile,
    extensionForKind,
    isCatalogKind,
    kindFromExtension,
    libraryFilename,
    serializeSoundList,
    deserializeSoundList,
} from '../src/utils/libraryFormat'
import { buildDeviceBackupPayload, parseDeviceBackupPrograms, parseDeviceBackupSequences } from '../src/utils/deviceBackup'

assert.equal(extensionForKind('sound'), 'vfm2_sound')
assert.equal(extensionForKind('sequence'), 'vfm2_seq')
assert.equal(extensionForKind('sound-list'), 'vfm2_list')
assert.equal(extensionForKind('bundle'), 'vfm2_bundle')
assert.equal(extensionForKind('backup'), 'vfm2_backup')
assert.equal(kindFromExtension('Lead.vfm2_sound'), 'sound')
assert.equal(kindFromExtension('groove.VFM2_SEQ'), 'sequence')
assert.equal(kindFromExtension('bank.vfm2_list'), 'sound-list')
assert.equal(kindFromExtension('all.vfm2_bundle'), 'bundle')
assert.equal(kindFromExtension('device.vfm2_backup'), 'backup')
assert.equal(libraryFilename('My Voice', 'sound'), 'My Voice.vfm2_sound')
assert.equal(isCatalogKind('backup'), true)
assert.equal(isCatalogKind('bundle'), false)

const sound = createInitialSoundProgram()
sound.name = 'BRASS 1'
const soundId = '11111111-1111-4111-8111-111111111111'
const soundFile = encodeLibraryFile(
    'sound',
    'Brass',
    { sound },
    1_700_000_000_000,
    soundId,
    'Warm brass lead\nUsed in intro',
)
const decodedSound = decodeLibraryFile(soundFile, 'Brass.vfm2_sound')
assert.equal(decodedSound.kind, 'sound')
assert.equal(decodedSound.name, 'Brass')
assert.equal(decodedSound.id, soundId)
assert.equal(decodedSound.memo, 'Warm brass lead\nUsed in intro')
assert.equal((decodedSound.payload.sound as { name: string }).name, 'BRASS 1')
assert.equal(encodeSoundProgram(decodedSound.payload.sound as Parameters<typeof encodeSoundProgram>[0]).length, 140)

const soundFileWithoutId = encodeLibraryFile('sound', 'Brass', { sound })
assert.equal(decodeLibraryFile(soundFileWithoutId, 'Brass.vfm2_sound').id, undefined)
assert.equal(decodeLibraryFile(soundFileWithoutId, 'Brass.vfm2_sound').memo, undefined)

const sequence = { programNo: 3, notes: [], velocity: 100 }
const seqFile = encodeLibraryFile('sequence', 'Groove', { sequence })
const decodedSeq = decodeLibraryFile(seqFile, 'Groove.vfm2_seq')
assert.equal(decodedSeq.kind, 'sequence')
assert.equal((decodedSeq.payload.sequence as { programNo: number }).programNo, 3)
assert.equal(decodedSeq.payload.sound, undefined)

const seqWithSoundFile = encodeLibraryFile('sequence', 'Groove', { sequence, sound })
const decodedSeqWithSound = decodeLibraryFile(seqWithSoundFile, 'Groove.vfm2_seq')
assert.equal((decodedSeqWithSound.payload.sequence as { programNo: number }).programNo, 3)
assert.equal((decodedSeqWithSound.payload.sound as { name: string }).name, 'BRASS 1')

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

const catalogItems = [
    {
        id: soundId,
        kind: 'sound' as const,
        name: 'Brass',
        memo: 'Catalog brass memo',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_100,
        payload: { sound },
    },
    {
        id: '22222222-2222-4222-8222-222222222222',
        kind: 'sequence' as const,
        name: 'Groove',
        createdAt: 1_700_000_000_200,
        updatedAt: 1_700_000_000_300,
        payload: { sequence },
    },
    {
        id: '33333333-3333-4333-8333-333333333333',
        kind: 'sound-list' as const,
        name: 'Bank A',
        createdAt: 1_700_000_000_400,
        updatedAt: 1_700_000_000_500,
        payload: listPayload,
    },
]
const bundleFile = encodeLibraryFile('bundle', 'Session', { items: catalogItems })
const decodedBundle = decodeLibraryFile(bundleFile, 'Session.vfm2_bundle')
assert.equal(decodedBundle.kind, 'bundle')
assert.equal(decodedBundle.payload.items?.length, 3)
assert.equal(decodedBundle.payload.items?.[0]?.id, soundId)
assert.equal(decodedBundle.payload.items?.[0]?.memo, 'Catalog brass memo')
assert.equal(decodedBundle.payload.items?.[1]?.kind, 'sequence')
assert.equal(decodedBundle.payload.items?.[1]?.memo, undefined)
assert.equal(decodedBundle.payload.sound, undefined)
assert.equal(decodedBundle.payload.sequence, undefined)
assert.equal(decodedBundle.payload.soundList, undefined)

const emptyBundle = decodeLibraryFile(encodeLibraryFile('bundle', 'Empty', { items: [] }), 'Empty.vfm2_bundle')
assert.equal(catalogItemsFromPayload(emptyBundle.payload).length, 0)

const legacyBundleFile = encodeLibraryFile('bundle', 'Legacy', {
    sound,
    sequence,
    soundList: serializeSoundList(programs),
})
const decodedLegacyBundle = decodeLibraryFile(legacyBundleFile, 'Legacy.vfm2_bundle')
assert.ok(decodedLegacyBundle.payload.sound)
assert.ok(decodedLegacyBundle.payload.sequence)
assert.equal(decodedLegacyBundle.payload.soundList?.length, 64)
const legacyItems = catalogItemsFromPayload(decodedLegacyBundle.payload)
assert.equal(legacyItems.length, 3)
assert.equal(legacyItems[0]?.kind, 'sound')
assert.equal(legacyItems[1]?.kind, 'sequence')
assert.equal((legacyItems[1]?.payload.sound as { name: string } | undefined)?.name, 'BRASS 1')
assert.equal(legacyItems[2]?.kind, 'sound-list')
assert.match(legacyItems[0]?.id ?? '', /^[0-9a-f-]{36}$/i)

const backupPrograms = programs.map((program, slot) => (
    slot === 12 ? { name: 'CHIME', data: program.data } : program
))
const backupSequences = Array.from({ length: NUM_OF_SEQUENCES }, (_, slot) => ({
    ...createEmptySequenceState(),
    programNo: slot === 3 ? 12 : 0,
}))
const backupFile = encodeLibraryFile(
    'backup',
    'Device',
    buildDeviceBackupPayload(backupPrograms, backupSequences),
)
const decodedBackup = decodeLibraryFile(backupFile, 'Device.vfm2_backup')
assert.equal(decodedBackup.kind, 'backup')
assert.equal(decodedBackup.payload.items, undefined)
assert.equal(parseDeviceBackupPrograms(decodedBackup.payload)[12].name, 'CHIME')
assert.equal(parseDeviceBackupSequences(decodedBackup.payload)[3].programNo, 12)
assert.equal(catalogItemsFromPayload(decodedBackup.payload).length, 0)

assert.throws(() => decodeLibraryFile(encodeLibraryFile('backup', 'Bad', {
    programs: serializeSoundList(backupPrograms),
    sequences: backupSequences.slice(0, 15),
}), 'Bad.vfm2_backup'))

const backupId = '44444444-4444-4444-8444-444444444444'
const bundleWithBackup = encodeLibraryFile('bundle', 'With Backup', {
    items: [
        ...catalogItems,
        {
            id: backupId,
            kind: 'backup' as const,
            name: 'Device',
            createdAt: 1_700_000_000_600,
            updatedAt: 1_700_000_000_700,
            payload: decodedBackup.payload,
        },
    ],
})
const decodedBundleWithBackup = decodeLibraryFile(bundleWithBackup, 'With Backup.vfm2_bundle')
assert.equal(decodedBundleWithBackup.payload.items?.length, 4)
assert.equal(decodedBundleWithBackup.payload.items?.[3]?.kind, 'backup')
assert.equal(decodedBundleWithBackup.payload.items?.[3]?.id, backupId)
assert.equal(parseDeviceBackupPrograms(decodedBundleWithBackup.payload.items?.[3]?.payload ?? {})[12].name, 'CHIME')

console.log('Library file format verification passed.')
