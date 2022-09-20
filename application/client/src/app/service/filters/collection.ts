import { EntryConvertable, Entry, Recognizable } from '@platform/types/storage/entry';
import { unique } from '@platform/env/sequence';
import { Subject } from '@platform/env/subscription';
import { error, Instance as Logger } from '@platform/env/logger';
import { scope } from '@platform/env/scope';
import { Definition, IDefinition } from './definition';

import * as obj from '@platform/env/obj';

export interface Update {
    name(value: string): Update;
    created(value: number): Update;
    used(value: number): Update;
}

export class Collection<T extends Recognizable & EntryConvertable>
    implements Recognizable, EntryConvertable
{
    protected entries: Map<string, T> = new Map();
    protected parser: (str: string) => T | Error;
    protected readonly logger: Logger;
    protected definition!: Definition;
    private _uuid: string;

    constructor(parser: (str: string) => T | Error, definition?: IDefinition) {
        this._uuid = unique();
        this.parser = parser;
        definition !== undefined && (this.definition = new Definition(definition));
        this.logger = scope.getLogger(`Collection: ${this.definition.name}`);
    }

    public uuid(): string {
        return this._uuid;
    }

    public update(): Update {
        const self = this;
        const body = {
            name: (value: string): Update => {
                self.definition.name = value;
                return body;
            },
            created: (value: number): Update => {
                self.definition.created = value;
                return body;
            },
            used: (value: number): Update => {
                self.definition.used = value;
                return body;
            },
        };
        return body;
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
                    uuid: this._uuid,
                    content: JSON.stringify({
                        definition: this.definition.minify(),
                        entries: Array.from(this.entries.values()).map((ent) => ent.entry().to()),
                    }),
                };
            },
            from: (entry: Entry): Error | undefined => {
                try {
                    this.entries.clear();
                    const stored: {
                        definition: Definition;
                        entries: Entry[];
                    } = JSON.parse(entry.content);
                    this.definition = Definition.fromMinifiedStr(
                        obj.getAsObj(stored, 'definition'),
                    );
                    this._uuid = entry.uuid;
                    obj.getAsArray<Entry>(stored, 'entries').forEach((entry: Entry) => {
                        const entity = this.parser(entry.content);
                        if (entity instanceof Error) {
                            this.logger.warn(`Fail to parse entry: ${entity.message}`);
                            return;
                        }
                        this.entries.set(entity.uuid(), entity);
                    });
                } catch (e) {
                    return new Error(error(e));
                }
                return undefined;
            },
            hash: (): string => {
                return this._uuid;
            },
            uuid: (): string => {
                return this._uuid;
            },
            updated: (): Subject<void> | undefined => {
                return undefined;
            },
        };
    }
}
