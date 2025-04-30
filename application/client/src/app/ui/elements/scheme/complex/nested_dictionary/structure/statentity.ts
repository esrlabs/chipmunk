import { Matchee } from '@module/matcher';

import * as wasm from '@loader/wasm';

export class DictionaryEntities extends Matchee {
    public selected: boolean = false;

    constructor(
        public readonly id: string,
        public readonly parent: string,
        public readonly data: Map<string, string | number>,
        protected readonly matcher: wasm.Matcher,
    ) {
        super(matcher, { id: id });
    }

    public keys(): string[] {
        return Array.from(this.data.keys());
    }
    public value(key: string): string | number | undefined {
        return this.data.get(key);
    }

    public html(): string {
        const html: string | undefined = this.getHtmlOf('html_id');
        return html === undefined ? this.id : html;
    }

    public hash(): string {
        return `${this.parent}-${this.id}`;
    }

    public equal(entity: DictionaryEntities): boolean {
        return entity.hash() === this.hash();
    }

    public toggle() {
        this.selected = !this.selected;
    }

    public select() {
        this.selected = true;
    }

    public unselect() {
        this.selected = false;
    }

    public hidden(): boolean {
        return this.getScore() === 0;
    }
}
