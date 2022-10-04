import { EntryConvertable, Entry, Recognizable } from '@platform/types/storage/entry';
import { StaticRowInputs, Row, Owner } from '@schema/content/row';
import { Subject } from '@platform/env/subscription';
import { error } from '@platform/env/logger';
import { IGrabbedElement } from '@platform/types/content';
import { session } from '@service/session';
import { Json } from '@platform/types/storage/json';
import { Equal } from '@platform/types/env/types';

import * as obj from '@platform/env/obj';

export class Bookmark
    extends Json<Bookmark>
    implements Recognizable, EntryConvertable, Equal<Bookmark>
{
    public static KEY: string = 'bookmark';

    public static from(input: Entry | string): Bookmark | Error {
        let entry: Entry | Error;
        if (typeof input === 'string') {
            entry = EntryConvertable.from(input);
        } else {
            entry = input;
        }
        if (entry instanceof Error) {
            return entry;
        }
        const bookmark = new Bookmark();
        const error = bookmark.entry().from(entry);
        if (error instanceof Error) {
            return error;
        }
        return bookmark;
    }

    public static fromJson(json: string): Bookmark | Error {
        try {
            const def: StaticRowInputs = JSON.parse(json);
            def.stream = obj.getAsValidNumber(def, 'stream');
            def.content = obj.getAsString(def, 'content');
            def.source = obj.getAsValidNumber(def, 'source');
            return new Bookmark(def);
        } catch (e) {
            return new Error(error(e));
        }
    }

    private readonly row: StaticRowInputs;
    private readonly _updated: Subject<void> = new Subject();

    constructor(row?: StaticRowInputs) {
        super();
        this.row = row === undefined ? { stream: -1, source: -1, content: '' } : row;
    }

    public stream(): number {
        return this.row.stream;
    }

    public as(): {
        grabbed(row: number): IGrabbedElement;
        row(row: number): Row;
    } {
        return {
            grabbed: (row: number): IGrabbedElement => {
                return {
                    position: this.row.stream,
                    source_id: this.row.source.toString(),
                    content: this.row.content,
                    row,
                };
            },
            row: (row: number): Row => {
                const active = session.active().session();
                if (active === undefined) {
                    throw new Error(
                        `Cannot create row from bookmark becuase there are no active session behind`,
                    );
                }
                return new Row({
                    content: this.row.content,
                    source: this.row.source,
                    session: active,
                    position: {
                        view: row,
                        stream: this.row.stream,
                    },
                    owner: Owner.Bookmark,
                });
            },
        };
    }

    public uuid(): string {
        return this.stream().toString();
    }

    public isSame(bookmark: Bookmark): boolean {
        return bookmark.stream() === this.stream();
    }

    public json(): {
        to(): string;
        from(str: string): Bookmark | Error;
        key(): string;
    } {
        return {
            to: (): string => {
                return JSON.stringify(this.row);
            },
            from: (json: string): Bookmark | Error => {
                return Bookmark.fromJson(json);
            },
            key: (): string => {
                return Bookmark.KEY;
            },
        };
    }

    public entry(): {
        to(): Entry;
        from(entry: Entry): Error | undefined;
        hash(): string;
        uuid(): string;
        updated(): Subject<void>;
    } {
        return {
            to: (): Entry => {
                return {
                    uuid: this.row.stream.toString(),
                    content: JSON.stringify(this.row),
                };
            },
            from: (entry: Entry): Error | undefined => {
                try {
                    const def: StaticRowInputs = JSON.parse(entry.content);
                    def.stream = obj.getAsValidNumber(def, 'stream');
                    def.content = obj.getAsString(def, 'content');
                    def.source = obj.getAsValidNumber(def, 'source');
                } catch (e) {
                    return new Error(error(e));
                }
                return undefined;
            },
            hash: (): string => {
                return this.row.stream.toString();
            },
            uuid: (): string => {
                return this.row.stream.toString();
            },
            updated: (): Subject<void> => {
                return this._updated;
            },
        };
    }
}
