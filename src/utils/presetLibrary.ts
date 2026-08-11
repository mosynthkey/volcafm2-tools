export type PresetKind = 'sound' | 'sequence';

export interface PresetRecord<T = unknown> {
    id: string;
    kind: PresetKind;
    name: string;
    data: T;
    createdAt: number;
    updatedAt: number;
}

const DB_NAME = 'volcafm2-editor';
const DB_VERSION = 1;
const STORE_NAME = 'presets';

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('IndexedDBを開けませんでした。'));
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
            request.onerror = () => reject(request.error ?? new Error('IndexedDBの操作に失敗しました。'));
            transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDBの操作が中断されました。'));
        });
    } finally {
        db.close();
    }
};

export const listPresets = async <T>(kind: PresetKind): Promise<PresetRecord<T>[]> => {
    const records = await runRequest('readonly', store => store.index('kind').getAll(kind)) as PresetRecord<T>[];
    return records.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const savePreset = async <T>(kind: PresetKind, name: string, data: T): Promise<PresetRecord<T>> => {
    const now = Date.now();
    const record: PresetRecord<T> = {
        id: crypto.randomUUID(),
        kind,
        name: name.trim(),
        data: JSON.parse(JSON.stringify(data)) as T,
        createdAt: now,
        updatedAt: now,
    };
    await runRequest('readwrite', store => store.put(record));
    return record;
};

export const deletePreset = async (id: string) => {
    await runRequest('readwrite', store => store.delete(id));
};
