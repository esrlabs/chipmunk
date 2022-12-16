import { Mutable } from '../unity/mutable';
import { Storage } from './storage';

export abstract class Record<T extends string | number | boolean | undefined> {
    public static fullpath(path: string, key: string): string {
        return `${path}${path === '' ? '' : '.'}${key}`;
    }
    public abstract validate(value: T): Error | undefined;

    protected value: T;
    protected storage!: Storage;
    public readonly path!: string;
    public readonly key!: string;

    constructor(value: T, path?: string, key?: string) {
        path !== undefined && (this.path = path);
        key !== undefined && (this.key = key);
        this.value = value;
    }

    public locate(path: string, key: string): Record<T> {
        (this as Mutable<Record<T>>).path = path;
        (this as Mutable<Record<T>>).key = key;
        return this;
    }

    public bind(storage: Storage): Error | undefined {
        this.storage = storage;
        const value = this.storage.get(this.path, this.key) as T;
        if (value === undefined) {
            return;
        }
        const error = this.validate(value);
        return error instanceof Error ? error : this.set(value);
    }

    public read(): Error | undefined {
        const stored = this.storage.get(this.path, this.key);
        if (stored !== undefined) {
            const error = this.validate(stored as T);
            if (error instanceof Error) {
                return error;
            }
            this.value = stored as T;
        } else if (this.value !== undefined) {
            return this.set(this.value);
        }
        return undefined;
    }

    public fullpath(): string {
        return Record.fullpath(this.path, this.key);
    }

    public get(): T {
        return this.value;
    }

    public set(value: T): Error | undefined {
        if (this.storage === undefined) {
            return new Error(`Record isn't bound with storage`);
        }
        if (this.path === undefined || this.key === undefined) {
            return new Error(`Record isn't located. Setup "path" and "key"`);
        }
        if (value === undefined) {
            return this.storage.delete(this.path, this.key);
        }
        let error = this.validate(value);
        if (error instanceof Error) {
            return error;
        }
        this.value = value;
        error = this.storage.put(this.path, this.key, value);
        if (error instanceof Error) {
            return error;
        }
        this.storage.write();
        return undefined;
    }
}
