import { Matchee } from '@module/matcher';
import { getFileName } from '@platform/types/files';

import * as wasm from '@loader/wasm';

export class Folder extends Matchee {
    public readonly path: string;
    public readonly parent: string;

    protected readonly delimiter: string;

    constructor(parent: string, path: string, delimiter: string, matcher: wasm.Matcher) {
        super(matcher, {
            name: getFileName(path),
        });
        this.parent = parent;
        this.path = path;
        this.delimiter = delimiter;
    }

    public html(): string {
        const name: string | undefined = this.getHtmlOf('html_name');
        if (name === undefined) {
            return this.path;
        } else {
            const endsWithDelimiter = this.parent.endsWith(this.delimiter);
            return `${this.parent}${endsWithDelimiter ? '' : this.delimiter}${name}`;
        }
    }

    public hash(): string {
        return this.path;
    }
}
