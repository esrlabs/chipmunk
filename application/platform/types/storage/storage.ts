import { Read } from '../io/read';
import { Write } from '../io/write';
import { Destroyable } from '../life/destroyable';
import { utils } from '../../log';

import * as obj from '../../env/obj';

export interface IStorage {
    [key: string]: number | string | boolean | IStorage;
}

export class Storage {
    protected storage: IStorage;
    protected io: Read<string> & Write<string> & Destroyable<void>;

    constructor(io: Read<string> & Write<string> & Destroyable<void>, initial: IStorage = {}) {
        this.io = io;
        this.storage = initial;
    }

    public destroy(): Promise<void> {
        return this.io.destroy();
    }

    public load(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.io
                .read()
                .then((content: string) => {
                    if (content.trim() === '') {
                        return resolve();
                    }
                    try {
                        const stored = JSON.parse(content);
                        if (!obj.is(stored)) {
                            return reject(new Error(`Invalid content of file/storage`));
                        }
                        this.storage = stored;
                        resolve();
                    } catch (e) {
                        return reject(utils.error(e));
                    }
                })
                .catch(reject);
        });
    }

    public write(): void {
        this.io.write(JSON.stringify(this.storage));
    }

    public get<T extends string | number | boolean>(path: string, key: string): T | undefined {
        return obj.getPropByPath(this.storage, `${path}${path === '' ? '' : '.'}${key}`);
    }

    public put(path: string, key: string, value: string | number | boolean): Error | undefined {
        obj.createPath(this.storage, path);
        const seat = obj.getPropByPath(this.storage, path);
        if (!obj.is(seat)) {
            return new Error(`[${path}]: Fail to find destination.`);
        }
        (seat as IStorage)[key] = value;
        return undefined;
    }

    public delete(path: string, key: string): Error | undefined {
        const seat = obj.getPropByPath(this.storage, path);
        if (!obj.is(seat)) {
            return new Error(`[${path}]: Fail to find destination.`);
        }
        delete (seat as IStorage)[key];
        return undefined;
    }

    public overwrite(storage: IStorage): void {
        this.storage = storage;
    }
}
