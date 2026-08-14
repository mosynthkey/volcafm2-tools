import { packedVoiceToVolcaProgram } from '../midi/dx7Cartridge';

export const SOUND_LIST_SLOT_COUNT = 64;
export const SOUND_LIST_PROGRAM_SIZE = 128;
export const SOUND_LIST_DUMP_SIZE = 140;
export const SOUND_LIST_BACKUP_VERSION = 1;
export const SOUND_LIST_BACKUP_KIND = 'volca-fm2-sound-list';

export type SoundListProgram = {
    name: string;
    data: Uint8Array;
};

export type SoundListBackupProgram = {
    slot: number;
    name: string;
    data: string;
};

export type SoundListBackup = {
    version: number;
    kind: string;
    programs: SoundListBackupProgram[];
};

const hexDigit = (character: string) => {
    const code = character.charCodeAt(0);
    if (code >= 48 && code <= 57) return code - 48;
    if (code >= 97 && code <= 102) return code - 87;
    if (code >= 65 && code <= 70) return code - 55;
    return -1;
};

export const bytesToHex = (bytes: Uint8Array) =>
    Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');

export const hexToBytes = (hex: string): Uint8Array => {
    const normalized = hex.trim().replace(/\s+/g, '');
    if (normalized.length % 2 !== 0) throw new Error('Program data hex length must be even.');
    const bytes = new Uint8Array(normalized.length / 2);
    for (let byteIndex = 0; byteIndex < bytes.length; byteIndex++) {
        const high = hexDigit(normalized[byteIndex * 2]);
        const low = hexDigit(normalized[byteIndex * 2 + 1]);
        if (high < 0 || low < 0) throw new Error('Program data is not valid hex.');
        bytes[byteIndex] = (high << 4) | low;
    }
    return bytes;
};

export const padPackedProgram = (source?: Uint8Array) => {
    const packed = new Uint8Array(SOUND_LIST_PROGRAM_SIZE);
    if (source) packed.set(source.subarray(0, Math.min(source.length, SOUND_LIST_PROGRAM_SIZE)));
    return packed;
};

export const padProgramDump = (source?: Uint8Array) => {
    if (source && source.length >= SOUND_LIST_DUMP_SIZE) {
        const dump = new Uint8Array(SOUND_LIST_DUMP_SIZE);
        dump.set(source.subarray(0, SOUND_LIST_DUMP_SIZE));
        return dump;
    }
    return packedVoiceToVolcaProgram(padPackedProgram(source));
};

export const remapSlotAfterReorder = (slot: number | null, fromSlot: number, toSlot: number): number | null => {
    if (slot === null || fromSlot === toSlot) return slot;
    if (slot === fromSlot) return toSlot;
    if (fromSlot < toSlot && slot > fromSlot && slot <= toSlot) return slot - 1;
    if (fromSlot > toSlot && slot >= toSlot && slot < fromSlot) return slot + 1;
    return slot;
};

export const mapImportedVoiceSlots = (
    voiceCount: number,
    startSlot: number,
    slotCount = SOUND_LIST_SLOT_COUNT,
) => {
    const origin = ((startSlot % slotCount) + slotCount) % slotCount;
    return Array.from({ length: voiceCount }, (_, voiceIndex) => (origin + voiceIndex) % slotCount);
};

export const encodeSoundListBackup = (programs: SoundListProgram[]): string => {
    const backup: SoundListBackup = {
        version: SOUND_LIST_BACKUP_VERSION,
        kind: SOUND_LIST_BACKUP_KIND,
        programs: Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, slot) => ({
            slot,
            name: programs[slot]?.name ?? '',
            data: bytesToHex(padProgramDump(programs[slot]?.data)),
        })),
    };
    return `${JSON.stringify(backup, null, 2)}\n`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const readProgram = (value: unknown, slot: number): SoundListProgram => {
    if (!isRecord(value) || typeof value.data !== 'string') {
        throw new Error(`Program ${slot} is missing hex data.`);
    }
    const bytes = hexToBytes(value.data);
    if (bytes.length !== 128 && bytes.length !== 140) {
        throw new Error(`Program ${slot} must be 128 or 140 bytes.`);
    }
    return {
        name: typeof value.name === 'string' ? value.name : '',
        data: padProgramDump(bytes),
    };
};

export const decodeSoundListBackup = (json: string): SoundListProgram[] => {
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed)) throw new Error('Backup JSON must be an object.');
    if (parsed.version !== SOUND_LIST_BACKUP_VERSION) throw new Error('Unsupported backup version.');
    if (parsed.kind !== undefined && parsed.kind !== SOUND_LIST_BACKUP_KIND) {
        throw new Error('This JSON is not a volca fm2 sound list backup.');
    }
    if (!Array.isArray(parsed.programs) || parsed.programs.length !== SOUND_LIST_SLOT_COUNT) {
        throw new Error('Backup must contain 64 programs.');
    }
    return parsed.programs.map((program, slot) => readProgram(program, slot));
};
