import { Hash, Recognizable } from '@platform/types/storage/entry';
import { Subject, Subscriber, Subjects } from '@platform/env/subscription';
import { EntityUpdateEvent } from './store.update';
import { unique } from '@platform/env/sequence';

export enum Key {
    filters = 'filters',
    charts = 'charts',
    ranges = 'ranges',
    disabled = 'disabled',
}

export interface Updatable<E> {
    updated: Subject<E> | undefined;
}

export interface ChangeEvent<T> {
    entities: StoredEntity<T>[];
    sequence: string;
}

export type StoredEntity<T> = T & Hash & Recognizable & Updatable<EntityUpdateEvent<any, T>>;

export abstract class Store<T> extends Subscriber {
    public subjects: Subjects<{
        highlights: Subject<ChangeEvent<T>>;
        value: Subject<ChangeEvent<T>>;
        inner: Subject<ChangeEvent<T>>;
        any: Subject<ChangeEvent<T>>;
    }> = new Subjects({
        highlights: new Subject<ChangeEvent<T>>(),
        value: new Subject<ChangeEvent<T>>(),
        inner: new Subject<ChangeEvent<T>>(),
        any: new Subject<ChangeEvent<T>>(),
    });

    private _entities: Map<string, StoredEntity<T>> = new Map();
    private _hash: string = '';
    private _uuid: string;

    constructor(uuid: string) {
        super();
        this._uuid = uuid;
    }

    public destroy() {
        this.subjects.destroy();
        this.unsubscribe();
    }

    public overwrite(items: StoredEntity<T>[]): string {
        this._entities = new Map();
        items.forEach((item) => {
            this._entities.set(item.uuid(), item);
        });
        return this.refresh();
    }

    public refresh(): string {
        const sequence = unique();
        setTimeout(() => {
            this._update(sequence);
        });
        return sequence;
    }

    public update(items: StoredEntity<T>[]): string {
        items.forEach((item) => {
            this._entities.set(item.uuid(), item);
        });
        return this.refresh();
    }

    public delete(items: string[]): string {
        items.forEach((uuid) => {
            this._entities.delete(uuid);
        });
        return this.refresh();
    }

    public get(): StoredEntity<T>[] {
        return Array.from(this._entities.values());
    }

    public reorder(params: { prev: number; curt: number }) {
        let entities: StoredEntity<T>[] = this.get();
        const prev = entities[params.prev];
        if (prev === undefined) {
            return;
        }
        entities = entities.filter((_entity: StoredEntity<T>, index: number) => {
            return index !== params.prev;
        });
        entities.splice(params.curt, 0, prev);
        this.overwrite(entities);
    }

    public clear(): string {
        this._entities = new Map();
        return this.refresh();
    }

    public abstract key(): Key;

    public abstract has(entity: T): boolean;

    public hash(): string {
        return Array.from(this._entities.values())
            .map((entry) => entry.hash())
            .join('_');
    }

    private _update(sequence: string): void {
        const prev = this._hash;
        this._hash = Array.from(this._entities.keys()).join('_');
        if (prev !== this._hash) {
            const entities = Array.from(this._entities.values());
            this.subjects.get().value.emit({ entities, sequence });
            this.subjects.get().any.emit({ entities, sequence });
            this.subjects.get().highlights.emit({ entities, sequence });
        }
        this.unsubscribe();
        this._entities.forEach((entity) => {
            let hash = entity.hash();
            entity.updated !== undefined &&
                this.register(
                    entity.updated.subscribe((event) => {
                        const updated_hash = entity.hash();
                        if (hash !== updated_hash) {
                            hash = updated_hash;
                            const entities = Array.from(this._entities.values());
                            const sequence = unique();
                            if (event.consequence().highlights) {
                                this.subjects.get().highlights.emit({ entities, sequence });
                            }
                            if (event.consequence().inner) {
                                this.subjects.get().inner.emit({ entities, sequence });
                            }
                            if (event.consequence().value) {
                                this.subjects.get().value.emit({ entities, sequence });
                            }
                            this.subjects.get().any.emit({ entities, sequence });
                        }
                    }),
                );
        });
    }
}
