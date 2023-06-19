import { getParentFolder } from '@platform/types/files';
import { bridge } from '@service/bridge';

import * as obj from '@platform/env/obj';
import * as $ from '@platform/types/observe';

export interface IFileDesc {
    extention: string;
    checksum: string;
    filename: string;
    parent: string;
    size: number;
    created: number;
}

export class FileDesc implements IFileDesc {
    static async fromDataSource(source: $.Observe): Promise<IFileDesc | undefined> {
        const file = source.origin.as<$.Origin.File.Configuration>($.Origin.File.Configuration);
        if (file === undefined) {
            return undefined;
        }
        return FileDesc.fromFilename(file.filename());
    }
    static async fromFilename(filename: string): Promise<IFileDesc | undefined> {
        const file = (await bridge.files().getByPathWithCache([filename]))[0];
        if (file === undefined) {
            throw new Error(`Fail to get file(s) stat info`);
        }
        return {
            checksum: await bridge.files().checksumWithCache(file.filename),
            extention: file.ext.toLowerCase(),
            filename: file.name.toLowerCase(),
            parent: getParentFolder(file.filename).toLowerCase(),
            created: file.stat.ctimeMs,
            size: file.stat.size,
        };
    }
    static fromMinifiedStr(
        src: { [key: string]: number | string } | undefined,
    ): FileDesc | undefined {
        return src === undefined
            ? undefined
            : new FileDesc({
                  checksum: obj.getAsString(src, 'h'),
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
    public checksum: string;

    constructor(definition: IFileDesc) {
        this.extention = definition.extention;
        this.filename = definition.filename;
        this.parent = definition.parent;
        this.size = definition.size;
        this.created = definition.created;
        this.checksum = definition.checksum;
    }

    public isSame(file: FileDesc): boolean {
        return file.checksum === this.checksum;
    }

    public asDesc(): IFileDesc {
        return {
            checksum: this.checksum,
            extention: this.extention,
            filename: this.filename,
            parent: this.parent,
            size: this.size,
            created: this.created,
        };
    }

    public minify(): { [key: string]: number | string } {
        return {
            e: this.extention,
            n: this.filename,
            p: this.parent,
            s: this.size,
            c: this.created,
            h: this.checksum,
        };
    }
}
