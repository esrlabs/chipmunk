import * as Toolkit from 'logviewer.client.toolkit';

export interface IStoreInfo {
    store: IDBObjectStore;
    transaction: IDBTransaction;
}

export default class ControllerIndexedDB<TRow> {

    public static Tables = {
        rows: 'rows'
    };

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _db: IDBDatabase | undefined;

    constructor(guid: string, name: string) {
        this._guid = guid;
        this._logger = new Toolkit.Logger(`[DB: ${name}]`);
    }

    public create(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            this._open().then((db: IDBDatabase) => {
                this._db = db;
                resolve(db);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._db === undefined) {
                return resolve();
            }
            // Close DB
            this._db.close();
            this._db = undefined;
            // Delete DB
            const request: IDBOpenDBRequest = indexedDB.deleteDatabase(this._guid);
            request.addEventListener('success', (event: Event) => {
                resolve();
            });
            request.addEventListener('error', (event: Event) => {
                // Report error, but resolve in anyway
                this._logger.warn(`Fail to remove DB "${this._guid}" due error: ${(event.target as any).error.message}`);
                resolve();
            });
        });
    }

    public write(rows: TRow[], offset: number = 0): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._db === undefined) {
                return reject(new Error(`Database isn't opened`));
            }
            this._getStore(ControllerIndexedDB.Tables.rows).then((storeInfo: IStoreInfo) => {
                storeInfo.transaction.addEventListener('complete', (event: Event) => {
                    resolve();
                });
                storeInfo.transaction.addEventListener('error', (event: Event) => {
                    reject(new Error(this._logger.warn(`Fail to add data due error: ${(event.target as any).error.message}`)));
                });
                rows.forEach((row: TRow, index) => {
                    // const request: IDBRequest = storeInfo.store.add(row, index + offset);
                    const request: IDBRequest = storeInfo.store.add(row);
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public read(lower?: number, upper?: number): Promise<TRow[]> {
        return new Promise((resolve, reject) => {
            if (this._db === undefined) {
                return reject(new Error(`Database isn't opened`));
            }
            if (lower === undefined && upper === undefined) {
                return reject(new Error(this._logger.warn(`No range is defined.`)));
            }
            let range: IDBKeyRange;
            if (lower !== undefined && upper !== undefined) {
                range = IDBKeyRange.bound(lower, upper);
            } else if (lower === undefined) {
                range = IDBKeyRange.upperBound(upper);
            } else if (upper === undefined) {
                range = IDBKeyRange.lowerBound(lower);
            }
            this._getStore(ControllerIndexedDB.Tables.rows).then((storeInfo: IStoreInfo) => {
                storeInfo.transaction.addEventListener('complete', (event: Event) => {
                    console.log('DB: readed');
                    // resolve();
                });
                storeInfo.transaction.addEventListener('error', (event: Event) => {
                    reject(new Error(this._logger.warn(`[transaction]: Fail read data due error: ${(event.target as any).error.message}`)));
                });
                const request: IDBRequest = storeInfo.store.getAll(range);
                request.addEventListener('success', (event: Event) => {
                    resolve(request.result);
                });
                request.addEventListener('error', (event: Event) => {
                    reject(new Error(this._logger.warn(`[request]: Fail to read range due error: ${(event.target as any).error.message}`)));
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _open(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            // Create database
            let db: IDBDatabase;
            const request: IDBOpenDBRequest = window.indexedDB.open(this._guid);
            request.addEventListener('success', (event: Event) => {
                db = db === undefined ? request.result : db;
                resolve(db);
            });
            request.addEventListener('upgradeneeded', (event: Event) => {
                db = (event.target as any).result as IDBDatabase;
                // Create table
                if (!db.objectStoreNames.contains(ControllerIndexedDB.Tables.rows)) {
                    db.createObjectStore(ControllerIndexedDB.Tables.rows, { autoIncrement: true });
                }
            });
            request.addEventListener('error', (event: Event) => {
                reject(new Error(this._logger.warn(`Fail to open/create database due error: ${(event.target as any).error.message}`)));
            });
        });
    }

    private _getStore(table: string): Promise<IStoreInfo> {
        return new Promise((resolve, reject) => {
            if (this._db === undefined) {
                return reject(new Error(`Database isn't opened`));
            }
            const transaction: IDBTransaction = this._db.transaction(table, 'readwrite');
            const store: IDBObjectStore = transaction.objectStore(table);
            resolve({
                store: store,
                transaction: transaction
            });
        });
    }

}
