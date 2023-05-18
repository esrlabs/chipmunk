import { Definition } from './definition';
import { FiltersCollection } from './collection.filters';
import { ChartsCollection } from './collection.charts';
import { DisabledCollection } from './collection.disabled';
import { BookmarksCollection } from './collection.bookmarks';
import { Collection } from './collection';
import { Session } from '@service/session/session';
import { EntryConvertable, Entry } from '@platform/types/storage/entry';
import { JsonSet } from '@platform/types/storage/json';
import { error } from '@platform/log/utils';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Equal, Empty } from '@platform/types/env/types';
import { Subject, Subscriber } from '@platform/env/subscription';
import { StorageCollections } from './storage.collections';

import * as obj from '@platform/env/obj';

export interface ICollection {
    name: string;
    created: number;
    last: number;
    used: number;
    uuid: string;
    preset: boolean;
    relations: string[];
    entries: JsonSet;
    origin: string | undefined;
}

@SetupLogger()
export class Collections implements EntryConvertable, Equal<Collections>, Empty {
    static from(smth: Session | Entry, storage: StorageCollections): Collections {
        if (smth instanceof Session) {
            const filters = smth.search.store().filters().get();
            const disabled = smth.search.store().disabled().get();
            const bookmarks = smth.bookmarks.get();
            return new Collections(
                `Collections:${smth.uuid()}`,
                {
                    name: '-',
                    last: Date.now(),
                    created: Date.now(),
                    used: 1,
                    uuid: smth.uuid(),
                    preset: false,
                    relations: [],
                    origin: undefined,
                    entries: filters
                        .map((f) => f.asJsonField())
                        .concat(disabled.map((d) => d.asJsonField()))
                        .concat(bookmarks.map((b) => b.asJsonField())),
                },
                storage,
            );
        } else {
            const def = Collections.fromMinifiedStr(JSON.parse(smth.content));
            return new Collections(
                `Collections:${def.uuid}`,
                Collections.fromMinifiedStr(JSON.parse(smth.content)),
                storage,
            );
        }
    }

    static fromMinifiedStr(src: { [key: string]: number | string }): ICollection {
        return {
            name: obj.getAsNotEmptyString(src, 'n'),
            created: obj.getAsValidNumber(src, 'c'),
            used: obj.getAsValidNumber(src, 'u'),
            last: obj.getAsValidNumber(src, 'l'),
            preset: obj.getAsBool(src, 'p'),
            uuid: obj.getAsNotEmptyString(src, 'uu'),
            relations: obj.getAsArray(src, 'r'),
            origin: obj.getAsNotEmptyStringOrAsUndefined(src, 'o'),
            entries: obj.getAsObj(src, 'e'),
        };
    }

    protected readonly storage: StorageCollections;

    public name: string;
    public created: number;
    public used: number;
    public last: number;
    public uuid: string;
    public preset: boolean;
    public relations: string[];
    public origin: string | undefined;

    public readonly collections: {
        filters: FiltersCollection;
        charts: ChartsCollection;
        disabled: DisabledCollection;
        bookmarks: BookmarksCollection;
    } = {
        filters: new FiltersCollection(),
        charts: new ChartsCollection(),
        disabled: new DisabledCollection(),
        bookmarks: new BookmarksCollection(),
    };
    public readonly updated: Subject<void> = new Subject();

    constructor(alias: string, definition: ICollection, storage: StorageCollections) {
        this.setLoggerName(alias);
        this.name = definition.name;
        this.used = definition.used;
        this.last = definition.last;
        this.created = definition.created;
        this.uuid = definition.uuid;
        this.relations = definition.relations;
        this.origin = definition.origin;
        this.preset = definition.preset;
        this.storage = storage;
        this.load(definition.entries);
    }

    public subscribe(subscriber: Subscriber, session: Session): void {
        this.asCollectionsArray().forEach((c) => {
            subscriber.register(c.updated.subscribe(() => this.updated.emit()));
            c.subscribe(subscriber, session);
        });
    }

    public clone(): Collections {
        return new Collections(
            '',
            {
                name: this.name,
                used: this.used,
                created: this.created,
                uuid: this.uuid,
                relations: this.relations,
                preset: this.preset,
                last: this.last,
                origin: this.origin,
                entries: this.asCollectionsArray()
                    .map((c) => c.as().jsonSet())
                    .flat(),
            },
            this.storage,
        );
    }

    public delete() {
        this.storage.delete(this);
    }

    public bind(definition: Definition): void {
        if (this.origin === undefined) {
            // Origin source - it's first source for collection.
            this.origin = definition.uuid;
        }
        this.relations.indexOf(definition.uuid) === -1 && this.relations.push(definition.uuid);
    }

    public async applyTo(session: Session, definitions: Definition[]): Promise<void> {
        const origin = (() => {
            if (definitions.length === 1 && definitions[0].uuid === this.origin) {
                return true;
            }
            return false;
        })();
        const collections = this.asCollectionsArray().filter((c) =>
            origin ? true : !c.applicableOnlyToOrigin(),
        );
        const after = [];
        for (const collection of collections) {
            const cb = await collection.applyTo(session, definitions);
            after.push(cb);
        }
        after.forEach((cb) => cb());
    }

    public updateUuid(uuid: string | undefined): void {
        this.uuid = uuid !== undefined ? uuid : this.uuid;
    }

    public setName(name: string) {
        if (name.trim() === '' || name.trim() === '-') {
            this.name = '-';
            this.preset = false;
        } else {
            this.name = name;
            this.preset = true;
        }
        this.storage.update(this);
    }

    public hasName(): boolean {
        return this.name !== '' && this.name !== '-';
    }

    public isSame(collections: Collections): boolean {
        return (
            this.collections.filters.isSame(collections.collections.filters) &&
            this.collections.charts.isSame(collections.collections.charts) &&
            this.collections.disabled.isSame(collections.collections.disabled)
        );
    }

    protected load(entries: JsonSet) {
        this.asCollectionsArray().forEach((c) => c.load(entries));
    }

    protected overwrite(definition: ICollection) {
        this.name = definition.name;
        this.used = definition.used;
        this.last = definition.last;
        this.created = definition.created;
        this.uuid = definition.uuid;
        this.relations = definition.relations;
        this.origin = definition.origin;
        this.preset = definition.preset;
        this.load(definition.entries);
    }

    protected asCollectionsArray(): Collection<any>[] {
        return Object.keys(this.collections).map(
            (key) => (this.collections as { [key: string]: Collection<any> })[key],
        );
    }

    public isEmpty(): boolean {
        return (
            this.asCollectionsArray()
                .map((c) => c.elements.size)
                .reduce((prev, curr) => prev + curr, 0) === 0
        );
    }

    public minify(): {
        [key: string]:
            | number
            | string
            | { [key: string]: string | number }
            | string[]
            | JsonSet
            | boolean
            | undefined;
    } {
        return {
            n: this.name,
            c: this.created,
            u: this.used,
            l: this.last,
            uu: this.uuid,
            r: this.relations,
            o: this.origin,
            e: this.asCollectionsArray()
                .map((c) => c.as().jsonSet())
                .flat(),
            p: this.preset,
        };
    }

    public entry(): {
        to(): Entry;
        from(entry: Entry): Error | undefined;
        hash(): string;
        uuid(): string;
        updated(): Subject<void> | undefined;
    } {
        return {
            to: (): Entry => {
                return {
                    uuid: this.uuid,
                    content: JSON.stringify(this.minify()),
                };
            },
            from: (entry: Entry): Error | undefined => {
                try {
                    this.overwrite(Collections.fromMinifiedStr(JSON.parse(entry.content)));
                } catch (e) {
                    return new Error(error(e));
                }
                return undefined;
            },
            hash: (): string => {
                return this.uuid;
            },
            uuid: (): string => {
                return this.uuid;
            },
            updated: (): Subject<void> | undefined => {
                return undefined;
            },
        };
    }
}
export interface Collections extends LoggerInterface {}
