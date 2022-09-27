import { Definition } from './definition';
import { FiltersCollection } from './collection.filters';
import { DisabledCollection } from './collection.disabled';
import { Session } from '../session/session';
import { EntryConvertable, Entry } from '@platform/types/storage/entry';
import { JsonSet } from '@platform/types/storage/json';
import { error } from '@platform/env/logger';
import { Subject } from '@platform/env/subscription';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';

import * as obj from '@platform/env/obj';

export interface ICollection {
    name: string;
    created: number;
    used: number;
    uuid: string;
    preset: boolean;
    relations: string[];
    entries: JsonSet;
}

export interface UpdateOut {
    filters(): UpdateOut;
    disabled(): UpdateOut;
    uuid(uuid: string | undefined): UpdateOut;
}

@SetupLogger()
export class Collections implements EntryConvertable {
    static from(smth: Session | Entry): Collections {
        if (smth instanceof Session) {
            const filters = smth.search.store().filters().get();
            const disabled = smth.search.store().disabled().get();
            return new Collections(`Collections:${smth.uuid()}`, {
                name: '-',
                created: Date.now(),
                used: 1,
                uuid: smth.uuid(),
                preset: false,
                relations: [],
                entries: filters
                    .map((f) => f.asJsonField())
                    .concat(disabled.map((d) => d.asJsonField())),
            });
        } else {
            const def = Collections.fromMinifiedStr(JSON.parse(smth.content));
            return new Collections(
                `Collections:${def.uuid}`,
                Collections.fromMinifiedStr(JSON.parse(smth.content)),
            );
        }
    }

    static fromMinifiedStr(src: { [key: string]: number | string }): ICollection {
        return {
            name: obj.getAsNotEmptyString(src, 'n'),
            created: obj.getAsValidNumber(src, 'c'),
            used: obj.getAsValidNumber(src, 'u'),
            preset: obj.getAsBool(src, 'p'),
            uuid: obj.getAsNotEmptyString(src, 'uu'),
            relations: obj.getAsArray(src, 'r'),
            entries: obj.getAsObj(src, 'e'),
        };
    }

    public name: string;
    public created: number;
    public used: number;
    public uuid: string;
    public preset: boolean;
    public relations: string[];
    public collections: {
        filters: FiltersCollection;
        disabled: DisabledCollection;
    } = {
        filters: new FiltersCollection(),
        disabled: new DisabledCollection(),
    };

    constructor(alias: string, definition: ICollection) {
        this.setLoggerName(alias);
        this.name = definition.name;
        this.used = definition.used;
        this.created = definition.created;
        this.uuid = definition.uuid;
        this.relations = definition.relations;
        this.preset = definition.preset;
        this.load(definition.entries);
    }

    public bind(definition: Definition): void {
        this.relations.indexOf(definition.uuid) === -1 && this.relations.push(definition.uuid);
    }

    public update(session: Session): UpdateOut {
        const out: UpdateOut = {
            filters: (): UpdateOut => {
                this.collections.filters.update(session.search.store().filters().get());
                return out;
            },
            disabled: (): UpdateOut => {
                this.collections.disabled.update(session.search.store().disabled().get());
                return out;
            },
            uuid: (uuid: string | undefined): UpdateOut => {
                this.uuid = uuid !== undefined ? uuid : this.uuid;
                return out;
            },
        };
        return out;
    }

    public isSame(collections: Collections): boolean {
        return (
            this.collections.filters.isSame(collections.collections.filters) &&
            this.collections.disabled.isSame(collections.collections.disabled)
        );
    }

    protected load(entries: JsonSet) {
        [this.collections.filters, this.collections.disabled].forEach((c) => c.load(entries));
    }

    protected overwrite(definition: ICollection) {
        this.name = definition.name;
        this.used = definition.used;
        this.created = definition.created;
        this.uuid = definition.uuid;
        this.relations = definition.relations;
        this.preset = definition.preset;
        this.load(definition.entries);
    }

    public isEmpty(): boolean {
        return (
            this.collections.filters.elements.size + this.collections.filters.elements.size === 0
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
            uu: this.uuid,
            r: this.relations,
            e: this.collections.filters
                .as()
                .jsonSet()
                .concat(this.collections.disabled.as().jsonSet()),
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
