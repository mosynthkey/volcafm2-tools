import { NUM_OF_SEQUENCES, normalizeSequenceState, type SequenceState } from '../types/sequence'
import { SOUND_LIST_SLOT_COUNT, type SoundListProgram } from './soundListBackup'
import {
    deserializeSoundList,
    serializeSoundList,
    type LibraryPayload,
    type LibrarySoundList,
} from './libraryFormat'

export const DEVICE_SEQUENCE_COUNT = NUM_OF_SEQUENCES

export type DeviceBackupProgress = {
    phase: 'program' | 'sequence'
    current: number
    total: number
}

export const isDeviceBackupPayload = (payload: LibraryPayload): boolean =>
    Array.isArray(payload.programs)
    && payload.programs.length === SOUND_LIST_SLOT_COUNT
    && Array.isArray(payload.sequences)
    && payload.sequences.length === DEVICE_SEQUENCE_COUNT

export const buildDeviceBackupPayload = (
    programs: SoundListProgram[],
    sequences: SequenceState[],
): LibraryPayload => {
    if (programs.length !== SOUND_LIST_SLOT_COUNT) {
        throw new Error('Device backup must contain 64 programs.')
    }
    if (sequences.length !== DEVICE_SEQUENCE_COUNT) {
        throw new Error('Device backup must contain 16 sequences.')
    }
    return {
        programs: serializeSoundList(programs),
        sequences: sequences.map(sequence => normalizeSequenceState(sequence)),
    }
}

export const parseDeviceBackupPrograms = (payload: LibraryPayload): SoundListProgram[] =>
    deserializeSoundList(payload.programs ?? [])

export const parseDeviceBackupSequences = (payload: LibraryPayload): SequenceState[] => {
    if (!Array.isArray(payload.sequences) || payload.sequences.length !== DEVICE_SEQUENCE_COUNT) {
        throw new Error('Device backup must contain 16 sequences.')
    }
    return payload.sequences.map(sequence => normalizeSequenceState(sequence as Partial<SequenceState>))
}

export const backupProgramName = (programs: LibrarySoundList | SoundListProgram[], slot: number) => {
    const name = programs[slot]?.name
    return typeof name === 'string' ? name.trim() : ''
}
