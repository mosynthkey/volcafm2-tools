import {
    SOUND_LIST_BACKUP_KIND,
    SOUND_LIST_BACKUP_VERSION,
    SOUND_LIST_SLOT_COUNT,
    bytesToHex,
    decodeSoundListBackup,
    padProgramDump,
    type SoundListProgram,
} from './soundListBackup';
import { NUM_OF_SEQUENCES, normalizeSequenceState } from '../types/sequence';

export const LIBRARY_FILE_VERSION = 2;

export const LIBRARY_KINDS = ['sound', 'sound-list', 'sequence', 'backup', 'bundle'] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];
export const CATALOG_KINDS = ['sound', 'sound-list', 'sequence', 'backup'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export const LIBRARY_EXTENSIONS: Record<LibraryKind, string> = {
    sound: 'vfm2_sound',
    sequence: 'vfm2_seq',
    'sound-list': 'vfm2_list',
    bundle: 'vfm2_bundle',
    backup: 'vfm2_backup',
};

export const LIBRARY_FILE_ACCEPT = '.vfm2_sound,.vfm2_seq,.vfm2_list,.vfm2_bundle,.vfm2_backup,.json';

export const LIBRARY_FILE_KIND: Record<LibraryKind, string> = {
    sound: 'volca-fm2-sound',
    sequence: 'volca-fm2-sequence',
    'sound-list': SOUND_LIST_BACKUP_KIND,
    bundle: 'volca-fm2-bundle',
    backup: 'volca-fm2-backup',
};

export type LibrarySoundList = {
    name: string;
    data: string;
}[];

export type LibraryItemSnapshot = {
    id: string;
    kind: CatalogKind;
    name: string;
    createdAt: number;
    updatedAt: number;
    payload: LibraryPayload;
};

export type LibraryPayload = {
    sound?: unknown;
    sequence?: unknown;
    soundList?: LibrarySoundList;
    programs?: LibrarySoundList;
    sequences?: unknown[];
    items?: LibraryItemSnapshot[];
};

export type LibraryFile = {
    version: number;
    kind: string;
    name: string;
    savedAt: number;
    id?: string;
} & LibraryPayload;

export type DecodedLibraryFile = {
    kind: LibraryKind;
    name: string;
    savedAt: number;
    id?: string;
    payload: LibraryPayload;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const extensionForKind = (kind: LibraryKind) => LIBRARY_EXTENSIONS[kind];

export const kindFromExtension = (filename: string): LibraryKind | null => {
    const lower = filename.trim().toLowerCase();
    if (lower.endsWith('.vfm2_sound')) return 'sound';
    if (lower.endsWith('.vfm2_seq')) return 'sequence';
    if (lower.endsWith('.vfm2_list')) return 'sound-list';
    if (lower.endsWith('.vfm2_bundle')) return 'bundle';
    if (lower.endsWith('.vfm2_backup')) return 'backup';
    return null;
};

export const libraryFilename = (name: string, kind: LibraryKind) => {
    const safe = name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ').trim().replace(/\s+/g, ' ') || 'untitled';
    return `${safe}.${extensionForKind(kind)}`;
};

export const serializeSoundList = (programs: SoundListProgram[]): LibrarySoundList =>
    Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, slot) => ({
        name: programs[slot]?.name ?? '',
        data: bytesToHex(padProgramDump(programs[slot]?.data)),
    }));

export const deserializeSoundList = (programs: LibrarySoundList): SoundListProgram[] => {
    if (!Array.isArray(programs) || programs.length !== SOUND_LIST_SLOT_COUNT) {
        throw new Error('Program list must contain 64 programs.');
    }
    return programs.map((program, slot) => {
        if (!program || typeof program.data !== 'string') {
            throw new Error(`Program ${slot} is missing hex data.`);
        }
        return {
            name: typeof program.name === 'string' ? program.name : '',
            data: padProgramDump(hexToBytesLoose(program.data)),
        };
    });
};

const hexToBytesLoose = (hex: string) => {
    const normalized = hex.trim().replace(/\s+/g, '');
    if (normalized.length % 2 !== 0) throw new Error('Program data hex length must be even.');
    const bytes = new Uint8Array(normalized.length / 2);
    for (let byteIndex = 0; byteIndex < bytes.length; byteIndex++) {
        const value = Number.parseInt(normalized.slice(byteIndex * 2, byteIndex * 2 + 2), 16);
        if (!Number.isFinite(value)) throw new Error('Program data is not valid hex.');
        bytes[byteIndex] = value;
    }
    return bytes;
};

const kindFromFileKind = (kind: string): LibraryKind | null => {
    if (kind === LIBRARY_FILE_KIND.sound) return 'sound';
    if (kind === LIBRARY_FILE_KIND.sequence) return 'sequence';
    if (kind === LIBRARY_FILE_KIND['sound-list'] || kind === 'volca-fm2-sound-list') return 'sound-list';
    if (kind === LIBRARY_FILE_KIND.bundle) return 'bundle';
    if (kind === LIBRARY_FILE_KIND.backup) return 'backup';
    return null;
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const encodeLibraryFile = (
    kind: LibraryKind,
    name: string,
    payload: LibraryPayload,
    savedAt = Date.now(),
    id?: string,
): string => {
    const file: LibraryFile = {
        version: LIBRARY_FILE_VERSION,
        kind: LIBRARY_FILE_KIND[kind],
        name: name.trim(),
        savedAt,
        ...(id ? { id } : {}),
        ...cloneJson(payload),
    };
    return `${JSON.stringify(file, null, 2)}\n`;
};

export const isCatalogKind = (kind: unknown): kind is CatalogKind =>
    kind === 'sound' || kind === 'sound-list' || kind === 'sequence' || kind === 'backup';

const snapshotFromUnknown = (value: unknown): LibraryItemSnapshot | null => {
    if (!isRecord(value) || !isCatalogKind(value.kind) || typeof value.id !== 'string' || !value.id.trim()) return null;
    const payload = isRecord(value.payload) ? value.payload as LibraryPayload : {};
    return {
        id: value.id.trim(),
        kind: value.kind,
        name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'untitled',
        createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
        updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
        payload,
    };
};

export const catalogItemsFromPayload = (payload: LibraryPayload): LibraryItemSnapshot[] => {
    if (Array.isArray(payload.items)) {
        return payload.items.flatMap(item => {
            const snapshot = snapshotFromUnknown(item);
            return snapshot ? [snapshot] : [];
        });
    }
    const now = Date.now();
    const items: LibraryItemSnapshot[] = [];
    if (payload.sound !== undefined) {
        items.push({ id: crypto.randomUUID(), kind: 'sound', name: 'Program', createdAt: now, updatedAt: now, payload: { sound: payload.sound } });
    }
    if (payload.sequence !== undefined) {
        items.push({ id: crypto.randomUUID(), kind: 'sequence', name: 'Sequence', createdAt: now, updatedAt: now, payload: { sequence: payload.sequence } });
    }
    if (payload.soundList) {
        items.push({ id: crypto.randomUUID(), kind: 'sound-list', name: 'Program list', createdAt: now, updatedAt: now, payload: { soundList: payload.soundList } });
    }
    return items;
};

const payloadFromFile = (parsed: Record<string, unknown>, kind: LibraryKind): LibraryPayload => {
    if (kind === 'sound-list' && Array.isArray(parsed.programs) && !parsed.soundList) {
        return { soundList: serializeSoundList(decodeSoundListBackup(JSON.stringify(parsed))) };
    }
    const payload: LibraryPayload = {};
    if (parsed.sound !== undefined) payload.sound = parsed.sound;
    if (parsed.sequence !== undefined) payload.sequence = parsed.sequence;
    if (Array.isArray(parsed.soundList)) payload.soundList = parsed.soundList as LibrarySoundList;
    if (Array.isArray(parsed.programs)) payload.programs = parsed.programs as LibrarySoundList;
    if (Array.isArray(parsed.sequences)) payload.sequences = parsed.sequences as unknown[];
    if (Array.isArray(parsed.items)) {
        payload.items = parsed.items.flatMap(item => {
            const snapshot = snapshotFromUnknown(item);
            return snapshot ? [snapshot] : [];
        });
    }
    if (kind === 'sound' && payload.sound === undefined && parsed.data !== undefined) payload.sound = parsed.data;
    if (kind === 'sequence' && payload.sequence === undefined && parsed.data !== undefined) payload.sequence = parsed.data;
    return payload;
};

export const decodeLibraryFile = (json: string, filename = ''): DecodedLibraryFile => {
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed)) throw new Error('Library JSON must be an object.');

    const namedKind = typeof parsed.kind === 'string' ? kindFromFileKind(parsed.kind) : null;
    const extensionKind = kindFromExtension(filename);
    let kind = namedKind ?? extensionKind;

    if (!kind && parsed.version === SOUND_LIST_BACKUP_VERSION && Array.isArray(parsed.programs)) {
        kind = 'sound-list';
    }
    if (!kind) throw new Error('Unknown library file kind.');

    const name = typeof parsed.name === 'string' && parsed.name.trim()
        ? parsed.name.trim()
        : filename.replace(/\.[^.]+$/, '') || 'untitled';
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now();
    const id = typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id.trim() : undefined;
    const payload = payloadFromFile(parsed, kind);
    if (kind === 'sound' && payload.sound === undefined) throw new Error('Sound file is missing sound data.');
    if (kind === 'sequence' && payload.sequence === undefined) throw new Error('Sequence file is missing sequence data.');
    if (kind === 'sound-list') deserializeSoundList(payload.soundList ?? []);
    if (kind === 'backup') {
        deserializeSoundList(payload.programs ?? []);
        if (!Array.isArray(payload.sequences) || payload.sequences.length !== NUM_OF_SEQUENCES) {
            throw new Error('Backup file must contain 16 sequences.');
        }
        payload.sequences = payload.sequences.map(sequence => normalizeSequenceState(sequence as Parameters<typeof normalizeSequenceState>[0]));
    }
    return { kind, name, savedAt, id, payload };
};
