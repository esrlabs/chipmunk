import { Matchee } from '@module/matcher';

import * as wasm from '@loader/wasm';

export class Item extends Matchee {
    public readonly parent: string;
    public readonly filename: string;
    public readonly name: string;

    constructor(filename: string, name: string, parent: string, matcher: wasm.Matcher) {
        super(matcher, {
            name,
        });
        this.filename = filename;
        this.name = name;
        this.parent = parent;
    }

    public description(): {
        major: string;
        minor: string;
    } {
        const major: string | undefined = this.getHtmlOf('html_name');
        return {
            major: major === undefined ? this.name : major,
            minor: this.parent,
        };
    }

    public hash(): string {
        return `${this.name}-${this.parent}`;
    }
}
