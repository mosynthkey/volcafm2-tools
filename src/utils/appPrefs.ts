import { appError } from './appError';

const DB_NAME = 'volcafm2-prefs';
const DB_VERSION = 1;
const STORE_NAME = 'prefs';

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? appError('common.indexedDbOpenFailed'));
    request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
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

export const getPref = async <T>(key: string): Promise<T | undefined> => {
    try {
        return await runRequest('readonly', store => store.get(key));
    } catch {
        return undefined;
    }
};

export const setPref = async (key: string, value: unknown) => {
    await runRequest('readwrite', store => store.put(value, key));
};
