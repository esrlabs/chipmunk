import { StorageCollections } from './storage.collections';
import { StorageDefinitions } from './storage.definitions';
import { Collections } from './collections';
import { Definition } from './definition';
import { EntryConvertable, Entry } from '@platform/types/storage/entry';
import { Subject } from '@platform/env/subscription';
import { unique } from '@platform/env/sequence';
import { error } from '@platform/log/utils';
import { bridge } from '@service/bridge';

export class Provider implements EntryConvertable {
    protected collections: Collections[] = [];
    protected definitions: Definition[] = [];
    protected readonly uuid: string = unique();
    protected readonly storage: {
        collections: StorageCollections;
        definitions: StorageDefinitions;
    };

    constructor(collections: StorageCollections, definitions: StorageDefinitions) {
        this.storage = {
            collections,
            definitions,
        };
    }

    public export(uuids: string[], filename: string): Promise<void> {
        this.collections = (
            uuids
                .map((uuid) => {
                    return this.storage.collections.get(uuid);
                })
                .filter((c) => c !== undefined) as Collections[]
        ).map((c) => c.clone());
        this.definitions = [];
        const names: { [key: string]: number } = {};
        this.collections = this.collections.map((col) => {
            const related: Definition[] = (
                col.relations
                    .map((uuid) => this.storage.definitions.get(uuid))
                    .filter((d) => d !== undefined) as Definition[]
            ).map((d) => d.toExport());
            if (related.length > 0) {
                this.definitions = this.definitions.concat(related);
                const name = related[0].getCollectionName();
                if (!col.hasName() && name !== '-') {
                    names[name] = names[name] === undefined ? 0 : names[name];
                    if (names[name] === 0) {
                        col.name = name;
                    } else {
                        col.name = `${name}:${names[name] + 1}`;
                    }
                    names[name] += 1;
                }
            }
            return col;
        });
        return bridge.entries({ file: filename }).overwrite([this.entry().to()]);
    }

    public import(filename: string): Promise<string[]> {
        return bridge
            .entries({ file: filename })
            .get()
            .then((entries) => {
                if (entries.length !== 1) {
                    return Promise.reject(new Error(`Invalid format of file`));
                }
                const error = this.entry().from(entries[0]);
                if (error instanceof Error) {
                    return Promise.reject(error);
                }
                this.collections = this.collections.map((col) => {
                    // Reassign uuids of definitions as soon as it will be diffrent in case
                    // if both users have same source
                    col.relations = col.relations.map((uuid) => {
                        let target = this.definitions.find((d) => d.uuid === uuid);
                        if (target === undefined) {
                            return uuid;
                        }
                        target = this.storage.definitions.update(target);
                        return target.uuid;
                    });
                    return col;
                });
                const uuid: string[] = this.collections.map(collection => collection.uuid);
                this.storage.definitions.add(this.definitions);
                this.storage.collections.add(this.collections);
                this.collections = [];
                this.definitions = [];
                return uuid;
            });
    }

    public minify(): { [key: string]: Entry[] } {
        return {
            c: this.collections.map((c) => c.entry().to()),
            d: this.definitions.map((d) => d.entry().to()),
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
                    const minified: { [key: string]: Entry[] } = JSON.parse(entry.content);
                    this.collections = minified['c'].map((entry) =>
                        Collections.from(entry, this.storage.collections),
                    );
                    this.definitions = minified['d'].map((entry) => Definition.from(entry));
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
