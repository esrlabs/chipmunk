import { Collection } from './collection';
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
    relations: string[];
    entries: JsonSet;
}
@SetupLogger()
export class SessionCollection implements ICollection, EntryConvertable {
    static from(session: Session): SessionCollection {
        const filters = session.search.store().filters().get();
        const disabled = session.search.store().disabled().get();
        return new SessionCollection(`SessionCollection:${session.uuid()}`, {
            name: '-',
            created: Date.now(),
            used: 1,
            uuid: session.uuid(),
            relations: [],
            entries: filters
                .map((f) => f.asJsonField())
                .concat(disabled.map((d) => d.asJsonField())),
        });
    }

    protected fromMinifiedStr(src: { [key: string]: number | string }): ICollection {
        return {
            name: obj.getAsNotEmptyString(src, 'n'),
            created: obj.getAsValidNumber(src, 'c'),
            used: obj.getAsValidNumber(src, 'u'),
            uuid: obj.getAsNotEmptyString(src, 'uu'),
            relations: obj.getAsArray(src, 'r'),
            entries: obj.getAsObj(src, 'e'),
        };
    }

    public name: string;
    public created: number;
    public used: number;
    public uuid: string;
    public relations: string[];
    public entries: JsonSet = [];
    public collections: Collection<any>[] = [new FiltersCollection(), new DisabledCollection()];

    constructor(alias: string, definition: ICollection) {
        this.setLoggerName(alias);
        this.name = definition.name;
        this.used = definition.used;
        this.created = definition.created;
        this.uuid = definition.uuid;
        this.relations = definition.relations;
        this.load(definition.entries);
    }

    protected load(entries: JsonSet) {
        this.entries = entries;
        this.collections.forEach((c) => c.load(entries));
    }

    protected overwrite(definition: ICollection) {
        this.name = definition.name;
        this.used = definition.used;
        this.created = definition.created;
        this.uuid = definition.uuid;
        this.relations = definition.relations;
        this.load(definition.entries);
    }

    public minify(): {
        [key: string]:
            | number
            | string
            | { [key: string]: string | number }
            | string[]
            | JsonSet
            | undefined;
    } {
        return {
            n: this.name,
            c: this.created,
            u: this.used,
            uu: this.uuid,
            r: this.relations,
            e: this.entries,
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
                    this.overwrite(this.fromMinifiedStr(JSON.parse(entry.content)));
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
export interface SessionCollection extends LoggerInterface {}
