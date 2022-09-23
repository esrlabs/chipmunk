import { DataSource } from '@platform/types/observe';
import { getFileExtention, getFileName, getParentFolder } from '@platform/types/files';

import * as obj from '@platform/env/obj';

export interface IFileDesc {
    extention: string;
    filename: string;
    parent: string;
}

export class FileDesc implements IFileDesc {
    static fromDataSource(source: DataSource): IFileDesc | undefined {
        if (source.File === undefined) {
            return undefined;
        }
        return {
            extention: getFileExtention(source.File[0]).toLowerCase(),
            filename: getFileName(source.File[0]).toLowerCase(),
            parent: getParentFolder(source.File[0]).toLowerCase(),
        }
    }
    static fromMinifiedStr(src: { [key: string]: number | string } | undefined): FileDesc | undefined {
        return src === undefined ? undefined : new FileDesc({
            extention: obj.getAsString(src, 'e'),
            filename: obj.getAsNotEmptyString(src, 'n'),
            parent: obj.getAsString(src, 'p'),
        });
    }

    public extention: string;
    public filename: string;
    public parent: string;

    constructor(definition: IFileDesc) {
        this.extention = definition.extention;
        this.filename = definition.filename;
        this.parent = definition.parent;
    }

    public isSame(file: FileDesc): boolean {
        return file.filename === this.filename && this.extention === file.extention;
    }

    public minify(): { [key: string]: number | string } {
        return {
            e: this.extention,
            n: this.filename,
            p: this.parent,
        };
    }
}
