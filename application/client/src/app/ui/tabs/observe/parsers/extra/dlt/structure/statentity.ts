import { LevelDistribution } from '@platform/types/observe/parser/dlt';
import { Matchee } from '@module/matcher';

import * as wasm from '@loader/wasm';

export class StatEntity extends Matchee {
    public selected: boolean = false;
    public id: string;
    public parent: string;
    public non_log: number;
    public log_fatal: number;
    public log_error: number;
    public log_warning: number;
    public log_info: number;
    public log_debug: number;
    public log_verbose: number;
    public log_invalid: number;

    constructor(id: string, parent: string, from: LevelDistribution, matcher: wasm.Matcher) {
        super(matcher, { id: id });
        this.id = id;
        this.parent = parent;
        this.non_log = from.non_log;
        this.log_fatal = from.log_fatal;
        this.log_error = from.log_error;
        this.log_warning = from.log_warning;
        this.log_info = from.log_info;
        this.log_debug = from.log_debug;
        this.log_verbose = from.log_verbose;
        this.log_invalid = from.log_invalid;
    }

    public html(): string {
        const html: string | undefined = this.getHtmlOf('html_id');
        return html === undefined ? this.id : html;
    }

    public hash(): string {
        return `${this.parent}-${this.id}`;
    }

    public equal(entity: StatEntity): boolean {
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
