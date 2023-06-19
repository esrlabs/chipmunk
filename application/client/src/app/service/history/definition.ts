import { FileDesc, IFileDesc } from './definition.file';
import { StreamDesc, IStreamDesc } from './definition.stream';
import { ConcatDesc } from './definition.concat';
import { unique } from '@platform/env/sequence';
import { EntryConvertable, Entry } from '@platform/types/storage/entry';
import { error } from '@platform/log/utils';
import { Subject } from '@platform/env/subscription';
import { Equal } from '@platform/types/env/types';
import { Collections } from './collections';

import * as obj from '@platform/env/obj';
import * as $ from '@platform/types/observe';

export interface IDefinition {
    stream?: IStreamDesc;
    file?: IFileDesc;
    concat?: IFileDesc[];
    parser: $.Parser.Protocol;
    uuid: string;
}

export interface GroupRelations {
    rank: number;
    caption?: string;
}
export class Definition implements EntryConvertable, Equal<Definition> {
    static from(entry: Entry): Definition {
        return Definition.fromMinifiedStr(JSON.parse(entry.content));
    }
    static async fromDataSource(source: $.Observe): Promise<Definition> {
        const parser = source.parser.instance.alias();
        const file = await FileDesc.fromDataSource(source);
        const concat = await ConcatDesc.fromDataSource(source);
        const stream = await StreamDesc.fromDataSource(source);
        if (file !== undefined) {
            return new Definition({
                file,
                stream: undefined,
                concat: undefined,
                parser,
                uuid: unique(),
            });
        } else if (concat !== undefined) {
            return new Definition({
                file: undefined,
                stream: undefined,
                concat,
                parser,
                uuid: unique(),
            });
        } else if (stream !== undefined) {
            return new Definition({
                file: undefined,
                concat: undefined,
                stream,
                parser,
                uuid: unique(),
            });
        } else {
            throw new Error(`Cannot detect a source of data. Not File, not Stream aren't defined`);
        }
    }
    static fromMinifiedStr(src: { [key: string]: number | string }): Definition {
        const def = new Definition({
            file: FileDesc.fromMinifiedStr(obj.getAsObjOrUndefined(src, 'f')),
            stream: StreamDesc.fromMinifiedStr(obj.getAsObjOrUndefined(src, 's')),
            concat: ConcatDesc.fromMinifiedStr(obj.getAsObjOrUndefined(src, 'c'))?.files,
            parser: obj.getAsNotEmptyString(src, 'p') as $.Parser.Protocol,
            uuid: obj.getAsNotEmptyString(src, 'u'),
        });
        if (def.file === undefined && def.stream === undefined && def.concat === undefined) {
            throw new Error(`Definition doesn't have description not for stream, not for file`);
        }
        return def;
    }

    public stream?: StreamDesc;
    public file?: FileDesc;
    public concat?: ConcatDesc;
    public parser: $.Parser.Protocol;
    public uuid: string;

    constructor(definition: IDefinition) {
        this.stream =
            definition.stream === undefined ? undefined : new StreamDesc(definition.stream);
        this.file = definition.file === undefined ? undefined : new FileDesc(definition.file);
        this.concat =
            definition.concat === undefined ? undefined : new ConcatDesc(definition.concat);
        this.parser = definition.parser;
        this.uuid = definition.uuid;
    }

    public overwrite(definition: Definition) {
        this.stream = definition.stream;
        this.file = definition.file;
        this.concat = definition.concat;
        this.parser = definition.parser;
        this.uuid = definition.uuid;
    }

    public isSame(definition: Definition): boolean {
        if (this.parser !== definition.parser) {
            return false;
        }
        if (definition.stream !== undefined && this.stream !== undefined) {
            return this.stream.isSame(definition.stream);
        }
        if (definition.file !== undefined && this.file !== undefined) {
            return this.file.isSame(definition.file);
        }
        if (definition.concat !== undefined && this.concat !== undefined) {
            return this.concat.isSame(definition.concat);
        }
        return false;
    }

    public check(): {
        related(collections: Collections): boolean;
        suitable(definition: Definition): GroupRelations | undefined;
    } {
        return {
            related: (collections: Collections): boolean => {
                return collections.relations.indexOf(this.uuid) !== -1;
            },
            suitable: (definition: Definition): GroupRelations | undefined => {
                if (this.parser !== definition.parser) {
                    return undefined;
                }
                if (this.file !== undefined && definition.file !== undefined) {
                    if (
                        (this.file.extention === definition.file.extention &&
                            this.file.filename === definition.file.filename) ||
                        this.file.checksum === definition.file.checksum
                    ) {
                        return { rank: 1, caption: 'Same file' };
                    }
                    if (this.file.extention === definition.file.extention) {
                        return { rank: 2, caption: 'Same file format' };
                    }
                    if (this.file.parent === definition.file.parent) {
                        return { rank: 3, caption: 'Same file location' };
                    }
                    return undefined;
                }
                if (this.stream !== undefined && definition.stream !== undefined) {
                    if (
                        this.stream.major === definition.stream.major &&
                        this.stream.minor === definition.stream.minor
                    ) {
                        return { rank: 1 };
                    }
                    if (this.stream.major === definition.stream.major) {
                        return { rank: 2 };
                    }
                    if (this.stream.minor === definition.stream.minor) {
                        return { rank: 3 };
                    }
                    return undefined;
                }
                return undefined;
            },
        };
    }

    public toExport(): Definition {
        const def = {
            stream: this.stream,
            file: this.file,
            concat: this.concat === undefined ? undefined : this.concat.files,
            parser: this.parser,
            uuid: this.uuid,
        };
        if (def.file !== undefined) {
            def.file.filename = unique();
            def.file.parent = unique();
        }
        return new Definition(def);
    }

    public getCollectionName(): string {
        if (this.file !== undefined) {
            return `files *.${this.file.extention}`;
        } else if (this.stream !== undefined) {
            return `${this.stream.major}`;
        } else {
            return '-';
        }
    }

    public minify(): {
        [key: string]:
            | number
            | string
            | { [key: string]: string | number }
            | Array<{ [key: string]: string | number }>
            | undefined;
    } {
        return {
            s: this.stream?.minify(),
            f: this.file?.minify(),
            c: this.concat?.minify(),
            p: this.parser,
            u: this.uuid,
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
                    this.overwrite(Definition.fromMinifiedStr(JSON.parse(entry.content)));
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
