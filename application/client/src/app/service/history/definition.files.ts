import { ObserveOperation } from '@service/session/dependencies/stream';
import { IFileDesc, FileDesc } from './definition.file';

export class ConcatDesc {
    static async fromDataSource(operation: ObserveOperation): Promise<IFileDesc[] | undefined> {
        const files = operation.getOrigin().getFiles();
        if (files === undefined) {
            return undefined;
        }
        const list: IFileDesc[] = [];
        for (const filename of files) {
            const desc = await FileDesc.fromFilename(filename);
            if (desc !== undefined) {
                list.push(desc);
            }
        }
        return list;
    }
    static fromMinifiedStr(
        src: Array<{ [key: string]: number | string }> | undefined,
    ): ConcatDesc | undefined {
        const files: IFileDesc[] = [];
        if (src === undefined) {
            return undefined;
        }
        src.forEach((src) => {
            const file = FileDesc.fromMinifiedStr(src);
            if (file === undefined) {
                return;
            }
            files.push(file.asDesc());
        });
        return src === undefined ? undefined : new ConcatDesc(files);
    }

    public files: IFileDesc[] = [];

    constructor(files: IFileDesc[]) {
        this.files = files;
    }

    public isSame(collection: ConcatDesc): boolean {
        if (this.files.length !== collection.files.length) {
            return false;
        }
        const targets = collection.files.map((f) => f.checksum);
        let matches: number = 0;
        this.files.forEach((f) => {
            matches += targets.includes(f.checksum) ? 1 : 0;
        });
        return matches === this.files.length;
    }

    public minify(): Array<{ [key: string]: number | string }> {
        return this.files.map((f) => new FileDesc(f).minify());
    }
}
