import { FileType } from '@platform/types/files';

import * as obj from '@platform/env/obj';

export enum Scope {
    Stream = 'Stream',
    File = 'File',
}

export interface IDefinition {
    scope: Scope;
    file?: FileType;
    name: string;
    created: number;
    used: number;
}

export class Definition implements IDefinition {
    static fromMinifiedStr(src: { [key: string]: number | string }): Definition {
        return new Definition({
            name: obj.getAsNotEmptyString(src, 'n'),
            file: obj.getAsNotEmptyStringOrAsUndefined(src, 'f') as FileType,
            created: obj.getAsValidNumber(src, 'c'),
            used: obj.getAsValidNumber(src, 'u'),
            scope: obj.getAsNotEmptyString(src, 's') as Scope,
        });
    }

    public scope!: Scope;
    public file?: FileType;
    public name!: string;
    public created!: number;
    public used!: number;

    constructor(definition: IDefinition) {
        this.scope = definition.scope;
        this.file = definition.file;
        this.name = definition.name;
        this.used = definition.used;
        this.created = definition.created;
    }

    public minify(): { [key: string]: number | string | FileType | Scope | undefined } {
        return {
            n: this.name,
            f: this.file,
            c: this.created,
            u: this.used,
            s: this.scope,
        };
    }
}
