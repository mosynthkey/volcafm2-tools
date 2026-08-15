import {
    SOUND_LIST_BACKUP_KIND,
    SOUND_LIST_BACKUP_VERSION,
    SOUND_LIST_SLOT_COUNT,
    bytesToHex,
    decodeSoundListBackup,
    padProgramDump,
    type SoundListProgram,
} from './soundListBackup';

export const LIBRARY_FILE_VERSION = 1;

export const LIBRARY_KINDS = ['sound', 'sound-list', 'sequence', 'bundle'] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const LIBRARY_EXTENSIONS: Record<LibraryKind, string> = {
    sound: 'vfm2_sound',
    sequence: 'vfm2_seq',
    'sound-list': 'vfm2_list',
    bundle: 'vfm2_bundle',
};

export const LIBRARY_FILE_ACCEPT = '.vfm2_sound,.vfm2_seq,.vfm2_list,.vfm2_bundle,.json';

export const LIBRARY_FILE_KIND: Record<LibraryKind, string> = {
    sound: 'volca-fm2-sound',
    sequence: 'volca-fm2-sequence',
    'sound-list': SOUND_LIST_BACKUP_KIND,
    bundle: 'volca-fm2-bundle',
};

export type LibrarySoundList = {
    name: string;
    data: string;
}[];

export type LibraryPayload = {
    sound?: unknown;
    sequence?: unknown;
    soundList?: LibrarySoundList;
};

export type LibraryFile = {
    version: number;
    kind: string;
    name: string;
    savedAt: number;
} & LibraryPayload;

export type DecodedLibraryFile = {
    kind: LibraryKind;
    name: string;
    savedAt: number;
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
        throw new Error('Sound list must contain 64 programs.');
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
    return null;
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const encodeLibraryFile = (kind: LibraryKind, name: string, payload: LibraryPayload, savedAt = Date.now()): string => {
    const file: LibraryFile = {
        version: LIBRARY_FILE_VERSION,
        kind: LIBRARY_FILE_KIND[kind],
        name: name.trim(),
        savedAt,
        ...cloneJson(payload),
    };
    return `${JSON.stringify(file, null, 2)}\n`;
};

const payloadFromFile = (parsed: Record<string, unknown>, kind: LibraryKind): LibraryPayload => {
    if (kind === 'sound-list' && Array.isArray(parsed.programs) && !parsed.soundList) {
        return { soundList: serializeSoundList(decodeSoundListBackup(JSON.stringify(parsed))) };
    }
    const payload: LibraryPayload = {};
    if (parsed.sound !== undefined) payload.sound = parsed.sound;
    if (parsed.sequence !== undefined) payload.sequence = parsed.sequence;
    if (Array.isArray(parsed.soundList)) payload.soundList = parsed.soundList as LibrarySoundList;
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
    const payload = payloadFromFile(parsed, kind);
    if (kind === 'sound' && payload.sound === undefined) throw new Error('Sound file is missing sound data.');
    if (kind === 'sequence' && payload.sequence === undefined) throw new Error('Sequence file is missing sequence data.');
    if (kind === 'sound-list') deserializeSoundList(payload.soundList ?? []);
    if (kind === 'bundle' && !payload.sound && !payload.sequence && !payload.soundList) {
        throw new Error('Bundle file is empty.');
    }
    return { kind, name, savedAt, payload };
};
