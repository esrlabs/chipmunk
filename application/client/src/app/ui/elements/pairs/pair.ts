import * as wasm from '@loader/wasm';

import { Matchee } from '@module/matcher';

export class Pair extends Matchee {
    public readonly name: string;
    public readonly value: string;

    static matcher: wasm.Matcher;

    constructor(name: string, value: string, matcher: wasm.Matcher) {
        super(matcher, { name: name, value: value });
        Pair.matcher = matcher;
        this.name = name;
        this.value = value;
    }

    public hidden(): boolean {
        return this.getScore() === 0;
    }

    public get html(): {
        name: string;
        value: string;
    } {
        const name: string | undefined = this.getHtmlOf('html_name');
        const value: string | undefined = this.getHtmlOf('html_value');
        return {
            name: name === undefined ? this.name : name,
            value: value === undefined ? this.value : value,
        };
    }
}
