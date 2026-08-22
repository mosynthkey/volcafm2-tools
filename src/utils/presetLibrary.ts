import { appError } from './appError';
import type { LibraryKind, LibraryPayload } from './libraryFormat';

export type { LibraryKind };

export interface LibraryRecord {
    id: string;
    kind: LibraryKind;
    name: string;
    memo: string;
    payload: LibraryPayload;
    createdAt: number;
    updatedAt: number;
}

type StoredRecord = LibraryRecord & { data?: unknown };

const DB_NAME = 'volcafm2-editor';
const DB_VERSION = 1;
const STORE_NAME = 'presets';

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? appError('common.indexedDbOpenFailed'));
    request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('kind', 'kind', { unique: false });
        }
    };
    request.onsuccess = () => resolve(request.result);
});

const runRequest = async <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) => {
    const db = await openDatabase();
    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, mode);
            const request = operation(transaction.objectStore(STORE_NAME));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? appError('common.indexedDbOpFailed'));
            transaction.onabort = () => reject(transaction.error ?? appError('common.indexedDbAborted'));
        });
    } finally {
        db.close();
    }
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizeMemo = (value: unknown) => (typeof value === 'string' ? value : '');

const normalizeRecord = (raw: StoredRecord): LibraryRecord => {
    if (raw.payload && typeof raw.payload === 'object') {
        return {
            id: raw.id,
            kind: raw.kind,
            name: raw.name,
            memo: normalizeMemo(raw.memo),
            payload: raw.payload,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }
    const payload: LibraryPayload = {};
    if (raw.kind === 'sound') payload.sound = raw.data;
    if (raw.kind === 'sequence') payload.sequence = raw.data;
    if (raw.kind === 'sound-list' && raw.data) payload.soundList = raw.data as LibraryPayload['soundList'];
    return {
        id: raw.id,
        kind: raw.kind,
        name: raw.name,
        memo: normalizeMemo(raw.memo),
        payload,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    };
};

export const listLibrary = async (kind?: LibraryKind): Promise<LibraryRecord[]> => {
    const records = kind
        ? await runRequest('readonly', store => store.index('kind').getAll(kind)) as StoredRecord[]
        : await runRequest('readonly', store => store.getAll()) as StoredRecord[];
    return records.map(normalizeRecord).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getLibrary = async (id: string): Promise<LibraryRecord | null> => {
    const raw = await runRequest('readonly', store => store.get(id)) as StoredRecord | undefined;
    return raw ? normalizeRecord(raw) : null;
};

export const saveLibrary = async (
    kind: LibraryKind,
    name: string,
    payload: LibraryPayload,
    memo = '',
): Promise<LibraryRecord> => {
    const now = Date.now();
    const record: LibraryRecord = {
        id: crypto.randomUUID(),
        kind,
        name: name.trim(),
        memo: memo.trim(),
        payload: cloneJson(payload),
        createdAt: now,
        updatedAt: now,
    };
    await runRequest('readwrite', store => store.put(record));
    return record;
};

export const updateLibraryMemo = async (id: string, memo: string): Promise<LibraryRecord | null> => {
    const existing = await getLibrary(id);
    if (!existing) return null;
    const record: LibraryRecord = {
        ...existing,
        memo: memo.trim(),
        updatedAt: Date.now(),
    };
    await runRequest('readwrite', store => store.put(record));
    return record;
};

export const importLibraryRecords = async (records: LibraryRecord[]): Promise<{ added: number; skipped: number }> => {
    let added = 0;
    let skipped = 0;
    for (const record of records) {
        if (record.kind === 'bundle' || !record.id) continue;
        if (await getLibrary(record.id)) {
            skipped += 1;
            continue;
        }
        await runRequest('readwrite', store => store.put(cloneJson(record)));
        added += 1;
    }
    return { added, skipped };
};

export const deleteLibrary = async (id: string) => {
    await runRequest('readwrite', store => store.delete(id));
};
