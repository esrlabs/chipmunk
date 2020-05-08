import { Element } from './field.render';

export enum ESettingType {
    standard = 'standard',
    advanced = 'advanced',
    hidden = 'hidden',
}

export interface IStorage {
    [key: string]: number | string | boolean | IStorage;
}

export interface IEntry {
    key: string;
    path: string;
    name: string;
    desc: string;
    type: ESettingType;
}

interface IEntryDesc {
    name: string;
    type: string;
    canBeEmpty: boolean;
}

const CEntryProps: IEntryDesc[] = [
    { name: 'key',  type: 'string', canBeEmpty: false, },
    { name: 'path', type: 'string', canBeEmpty: true, },
    { name: 'name', type: 'string', canBeEmpty: false, },
    { name: 'desc', type: 'string', canBeEmpty: false, },
    { name: 'type', type: 'string', canBeEmpty: false, },
];

export function getEntryError(entry: IEntry): Error | undefined {
    if (typeof entry !== 'object' || entry === null) {
        return new Error(`"entry" is not valid.`);
    }
    let error: Error | undefined;
    CEntryProps.forEach((_entry: IEntryDesc) => {
        if (error !== undefined) {
            return;
        }
        if (typeof (entry as any)[_entry.name] !== typeof _entry.type) {
            error = new Error(`Key "${_entry.name}" has wrong type "${typeof (entry as any)[_entry.name]}", but expected "${_entry.type}"`);
        }
        if (!_entry.canBeEmpty && typeof (entry as any)[_entry.name] === 'string') {
            if ((entry as any)[_entry.name].trim() === '') {
                error = new Error(`Key "${_entry.name}" could not be empty. Some value should be defined.`);
            }
        }
    });
    return error;
}

export function findRef(storage: IStorage, path: string | string[], fullpath?: string): IStorage | Error {
    if (fullpath === undefined) {
        fullpath = path instanceof Array ? path.join('.') : path;
    }
    if (typeof storage !== 'object' || storage === null) {
        return new Error(`[${fullpath}]: Expected "storage" would be an object`);
    }
    if (typeof path === 'string') {
        if (path === '') {
            return storage;
        } else {
            path = path.split('.');
        }
    }
    const ref = (storage as any)[path[0]];
    if (path.length === 1) {
        if (typeof ref !== 'object' || ref === null) {
            return new Error(`[${fullpath}]: Fail to find destination.`);
        } else {
            return ref;
        }
    } else {
        return findRef(ref, path.slice(1, path.length), fullpath);
    }
}

export function getEntryKey(entry: Entry | Field<any>): string {
    return `${entry.getPath()}${entry.getPath() === '' ? '' : '.'}${entry.getKey()}`;
}

export class Entry {

    private _key: string;
    private _name: string;
    private _desc: string;
    private _path: string;
    private _type: ESettingType;

    constructor(entry: IEntry) {
        const err: Error | undefined = getEntryError(entry);
        if (err instanceof Error) {
            throw err;
        }
        this._key = entry.key;
        this._name = entry.name;
        this._desc = entry.desc;
        this._path = entry.path;
        this._type = entry.type;
    }

    public getKey(): string {
        return this._key;
    }

    public getName(): string {
        return this._name;
    }

    public getDesc(): string {
        return this._desc;
    }

    public getPath(): string {
        return this._path;
    }

    public getFullPath(): string {
        return getEntryKey(this);
    }

    public getType(): ESettingType {
        return this._type;
    }

    public extract(store: IStorage): Promise<void> {
        return new Promise((resolve) => {
            // Dummy method to make code look nicer (see: service.settings.ts)
            resolve();
        });
    }

    public write(store: IStorage): Error | IStorage {
        if (typeof store !== 'object' && store === null) {
            return new Error(`Fail to write, because store isn't an object.`);
        }
        const ref: IStorage | Error = findRef(store, this.getPath());
        if (ref instanceof Error) {
            return ref;
        }
        if ((ref as any)[this.getKey()] === undefined) {
            (ref as any)[this.getKey()] = {};
        }
        return store;
    }

}

export abstract class Field<T> extends Entry {

    private _value: T | undefined;

    constructor(entry: IEntry) {
        super(entry);
    }

    public abstract validate(value: T): Promise<void>;
    public abstract getDefault(): Promise<T>;
    public abstract getElement(): Promise<Element<any> | undefined>;

    public extract(store: IStorage): Promise<void> {
        return new Promise((resolve, reject) => {
            const ref: IStorage | Error = findRef(store, this.getPath());
            if (ref instanceof Error) {
                return reject(ref);
            }
            const stored: T | undefined = (ref as any)[this.getKey()];
            if (stored === undefined) {
                this.getDefault().then((value: T) => {
                    this.set(value).then(resolve).catch(reject);
                });
                return;
            } else {
                this.validate(stored).then(() => {
                    this.set(stored).then(resolve).catch(reject);
                }).catch(reject);    
            }
        });
    }

    public set(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            this.validate(value).then(() => {
                this._value = value;
                resolve();
            }).catch((err: Error) => {
                reject(err);
            })
        });
    }

    public get(): T {
        if (this._value === undefined) {
            throw new Error(`Value of "${this.getFullPath()}" isn't initialized`);
        }
        return this._value;
    }

    public write(store: IStorage): Error | IStorage {
        if (typeof store !== 'object' && store === null) {
            return new Error(`Fail to write, because store isn't an object.`);
        }
        const ref: IStorage | Error = findRef(store, this.getPath());
        if (ref instanceof Error) {
            return ref;
        }
        (ref as any)[this.getKey()] = this.get();
        return store;
    }

}
