import { Entry } from 'platform/types/storage/entry';
import { error } from 'platform/log/utils';
import { SetupLogger, LoggerInterface } from 'platform/entity/logger';
import { Logger } from 'platform/log';

export type Writer = (key: string, content: string) => Error | undefined;
export type Reader = (key: string) => Promise<string>;

@SetupLogger('EntriesHolder')
export class Entries {
    static from(str: string, storageKey: string, logger: Logger): Map<string, Entry> {
        const entries = new Map<string, Entry>();
        const parsed = ((): Entry[] => {
            try {
                const inner = JSON.parse(str);
                return typeof inner === 'string' ? JSON.parse(inner) : inner;
            } catch (e) {
                throw new Error(`Fail to parse Entry[] from string: ${error(e)}`);
            }
        })();
        if (!(parsed instanceof Array)) {
            throw new Error(
                `Invalid format: expecting an Entry[], but has been gotten: ${typeof parsed}`,
            );
        }
        parsed.forEach((entry) => {
            if (typeof entry['uuid'] !== 'string' || entry['uuid'].trim() === '') {
                logger.warn(`Storage "${storageKey}" includes entries without valid "uuid"`);
                return;
            }
            if (typeof entry['content'] !== 'string' || entry['content'].trim() === '') {
                logger.warn(`Storage "${storageKey}" includes entries without valid "content"`);
                return;
            }
            entries.set(entry.uuid, entry);
        });
        return entries;
    }

    private readonly _writer: Writer;
    private readonly _reader: Reader;
    private _entries: Map<string, Map<string, Entry>> = new Map();

    constructor(writer: Writer, reader: Reader) {
        this._writer = writer;
        this._reader = reader;
    }

    public get(storageKey: string): Promise<Map<string, Entry>> {
        return new Promise((resolve, reject) => {
            const stored = this._entries.get(storageKey);
            if (stored !== undefined) {
                return resolve(stored);
            }
            this._reader(storageKey)
                .then((content: string) => {
                    try {
                        if (content === '') {
                            resolve(new Map());
                            return;
                        }
                        const entries = Entries.from(content, storageKey, this.log());
                        !this._entries.has(storageKey) && this._entries.set(storageKey, entries);
                        resolve(entries);
                    } catch (err) {
                        reject(new Error(error(err)));
                    }
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    public write(storageKey: string, entries: Map<string, Entry> | Entry[]): Error | undefined {
        const map =
            entries instanceof Array ? this._getEntriesFromArray(entries, storageKey) : entries;
        this._entries.set(storageKey, map);
        return this._writer(storageKey, JSON.stringify(Array.from(map.values())));
    }

    public append(storageKey: string, entries: Entry[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.get(storageKey)
                .then((stored) => {
                    entries.forEach((entry) => {
                        if (!stored.has(entry.uuid)) {
                            stored.set(entry.uuid, entry);
                        }
                    });
                    const writeError = this.write(storageKey, stored);
                    if (writeError instanceof Error) {
                        reject(writeError);
                    } else {
                        resolve();
                    }
                })
                .catch(reject);
        });
    }

    public update(storageKey: string, entries: Entry[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.get(storageKey)
                .then((stored) => {
                    entries.forEach((entry) => {
                        stored.set(entry.uuid, entry);
                    });
                    const writeError = this.write(storageKey, stored);
                    if (writeError instanceof Error) {
                        reject(writeError);
                    } else {
                        resolve();
                    }
                })
                .catch(reject);
        });
    }

    public overwrite(storageKey: string, entries: Entry[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const stored = new Map<string, Entry>();
            entries.forEach((entry) => {
                stored.set(entry.uuid, entry);
            });
            const writeError = this.write(storageKey, stored);
            if (writeError instanceof Error) {
                reject(writeError);
            } else {
                resolve();
            }
        });
    }

    public delete(storageKey: string, entries: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.get(storageKey)
                .then((stored) => {
                    entries.forEach((entry) => {
                        stored.delete(entry);
                    });
                    const writeError = this.write(storageKey, stored);
                    if (writeError instanceof Error) {
                        reject(writeError);
                    } else {
                        resolve();
                    }
                })
                .catch(reject);
        });
    }

    private _getEntriesFromArray(entries: Entry[], storageKey: string): Map<string, Entry> {
        const map = new Map<string, Entry>();
        entries.forEach((entry) => {
            if (typeof entry['uuid'] !== 'string' || entry['uuid'].trim() === '') {
                this.log().warn(`Storage "${storageKey}" includes entries without valid "uuid"`);
                return;
            }
            if (typeof entry['content'] !== 'string' || entry['content'].trim() === '') {
                this.log().warn(`Storage "${storageKey}" includes entries without valid "content"`);
                return;
            }
            map.set(entry.uuid, entry);
        });
        return map;
    }
}
export interface Entries extends LoggerInterface {}
