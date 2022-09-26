import { DataSource } from '@platform/types/observe';
import { getFileExtention, getFileName, getParentFolder } from '@platform/types/files';
import { bridge } from '@service/bridge';

import * as obj from '@platform/env/obj';

export interface IFileDesc {
    extention: string;
    filename: string;
    parent: string;
    size: number;
    created: number;
}

export class FileDesc implements IFileDesc {
    static async fromDataSource(source: DataSource): Promise<IFileDesc | undefined> {
        if (source.File === undefined) {
            return undefined;
        }
        const file = await bridge.files().getByPath([source.File[0]]);
        if (file.length !== 1) {
            throw new Error(`Fail to get file stat info`);
        }
        const stat = file[0].stat;
        return {
            extention: getFileExtention(source.File[0]).toLowerCase(),
            filename: getFileName(source.File[0]).toLowerCase(),
            parent: getParentFolder(source.File[0]).toLowerCase(),
            created: stat.ctimeMs,
            size: stat.size,
        };
    }
    static fromMinifiedStr(
        src: { [key: string]: number | string } | undefined,
    ): FileDesc | undefined {
        return src === undefined
            ? undefined
            : new FileDesc({
                  extention: obj.getAsString(src, 'e'),
                  filename: obj.getAsNotEmptyString(src, 'n'),
                  parent: obj.getAsString(src, 'p'),
                  size: obj.getAsValidNumber(src, 's'),
                  created: obj.getAsValidNumber(src, 'c'),
              });
    }

    public extention: string;
    public filename: string;
    public parent: string;
    public size: number;
    public created: number;

    constructor(definition: IFileDesc) {
        this.extention = definition.extention;
        this.filename = definition.filename;
        this.parent = definition.parent;
        this.size = definition.size;
        this.created = definition.created;
    }

    public isSame(file: FileDesc): boolean {
        return file.filename === this.filename && this.extention === file.extention;
    }

    public minify(): { [key: string]: number | string } {
        return {
            e: this.extention,
            n: this.filename,
            p: this.parent,
            s: this.size,
            c: this.created,
        };
    }
}
