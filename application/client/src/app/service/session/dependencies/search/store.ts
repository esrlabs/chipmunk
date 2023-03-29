import { Hash, Recognizable } from '@platform/types/storage/entry';
import { Subject, Subscriber, Subjects } from '@platform/env/subscription';
import { EntityUpdateEvent } from './store.update';

export enum Key {
    filters = 'filters',
    charts = 'charts',
    ranges = 'ranges',
    disabled = 'disabled',
}

export interface Updatable<E> {
    updated: Subject<E> | undefined;
}

export type StoredEntity<T> = T & Hash & Recognizable & Updatable<EntityUpdateEvent<any, T>>;

export abstract class Store<T> extends Subscriber {
    public subjects: Subjects<{
        highlights: Subject<StoredEntity<T>[]>;
        value: Subject<StoredEntity<T>[]>;
        inner: Subject<StoredEntity<T>[]>;
        any: Subject<StoredEntity<T>[]>;
    }> = new Subjects({
        highlights: new Subject<StoredEntity<T>[]>(),
        value: new Subject<StoredEntity<T>[]>(),
        inner: new Subject<StoredEntity<T>[]>(),
        any: new Subject<StoredEntity<T>[]>(),
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

    public overwrite(items: StoredEntity<T>[]): Store<T> {
        this._entities = new Map();
        items.forEach((item) => {
            this._entities.set(item.uuid(), item);
        });
        this._update();
        return this;
    }

    public refresh(): Store<T> {
        this._update();
        return this;
    }

    public update(items: StoredEntity<T>[]): Store<T> {
        items.forEach((item) => {
            this._entities.set(item.uuid(), item);
        });
        this._update();
        return this;
    }

    public delete(items: string[]): void {
        items.forEach((uuid) => {
            this._entities.delete(uuid);
        });
        this._update();
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

    public clear(): Promise<void> {
        this._entities = new Map();
        this._update();
        return Promise.resolve();
    }

    public abstract key(): Key;

    public abstract has(entity: T): boolean;

    public hash(): string {
        return Array.from(this._entities.values())
            .map((entry) => entry.hash())
            .join('_');
    }

    private _update(): void {
        const prev = this._hash;
        this._hash = Array.from(this._entities.keys()).join('_');
        if (prev !== this._hash) {
            this.subjects.get().value.emit(Array.from(this._entities.values()));
            this.subjects.get().any.emit(Array.from(this._entities.values()));
            this.subjects.get().highlights.emit(Array.from(this._entities.values()));
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
                            if (event.consequence().highlights) {
                                this.subjects
                                    .get()
                                    .highlights.emit(Array.from(this._entities.values()));
                            }
                            if (event.consequence().inner) {
                                this.subjects.get().inner.emit(Array.from(this._entities.values()));
                            }
                            if (event.consequence().value) {
                                this.subjects.get().value.emit(Array.from(this._entities.values()));
                            }
                            this.subjects.get().any.emit(Array.from(this._entities.values()));
                        }
                    }),
                );
        });
    }
}
