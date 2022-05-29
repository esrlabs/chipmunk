import { EntryConvertable, Entry } from '@platform/types/storage/entry';
import { Subject } from '@platform/env/subscription';

export enum Key {
    filters = 'filters',
    charts = 'charts',
    ranges = 'ranges',
    disabled = 'disabled',
}

export abstract class Store<T> {
    public subjects: {
        update: Subject<Array<T & EntryConvertable>>;
    } = {
        update: new Subject(),
    };

    private _entities: Map<string, T & EntryConvertable> = new Map();
    private _hash: string = '';
    private _uuid: string;

    constructor(uuid: string) {
        this._uuid = uuid;
    }

    public overwrite(items: Array<T & EntryConvertable>): void {
        this._entities = new Map();
        items.forEach((item) => {
            this._entities.set(item.entry().uuid(), item);
        });
        this._update();
    }

    public update(items: Array<T & EntryConvertable>): void {
        items.forEach((item) => {
            this._entities.set(item.entry().uuid(), item);
        });
        this._update();
    }

    public delete(items: string[]): void {
        items.forEach((uuid) => {
            this._entities.delete(uuid);
        });
        this._update();
    }

    public get(): Array<T & EntryConvertable> {
        return Array.from(this._entities.values());
    }
    /*
        const filter: FilterRequest = this._stored[params.prev];
        this._stored = this._stored.filter((i: FilterRequest, index: number) => {
            return index !== params.prev;
        });
        this._stored.splice(params.curt, 0, filter);
        this._subjects.updated.next({ requests: this._stored, updated: undefined });
*/
    public reorder(params: { prev: number; curt: number }) {
        let entities: Array<T & EntryConvertable> = this.get();
        const prev = entities[params.prev];
        if (prev === undefined) {
            return;
        }
        entities = entities.filter((_entity: T & EntryConvertable, index: number) => {
            return index !== params.prev;
        });
        entities.splice(params.curt, 0, prev);
        this.overwrite(entities);
    }

    public clear(): Promise<void> {
        this._entities = new Map();
        this._update();
        return Promise.resolve();
    }

    public abstract key(): Key;

    private _update(): void {
        const prev = this._hash;
        this._hash = Array.from(this._entities.keys()).join('_');
        if (prev !== this._hash) {
            this.subjects.update.emit(Array.from(this._entities.values()));
        }
    }
}
