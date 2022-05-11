import { LevelDistribution } from '@platform/types/parsers/dlt';
import { Subject } from '@platform/env/subscription';

import * as regex from '@platform/env/regex';

export interface Section {
    key: string;
    name: string;
    update: Subject<void>;
    entities: StatEntity[];
}

export class StatEntity {
    public selected: boolean = false;
    public hidden: boolean = false;
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

    private _filter: string = '';

    constructor(id: string, parent: string, from: LevelDistribution) {
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

    public getIdAsHtml(): string {
        if (this._filter === '') {
            return this.id;
        }
        const reg = regex.fromStr(this._filter);
        if (reg instanceof Error) {
            return this.id;
        }
        return this.id.replace(reg, (match, _p1, _p2, _p3, _offset, _string): string => {
            return `<span>${match}</span>`;
        });
    }

    public hash(): string {
        return `${this.parent}-${this.id}`;
    }

    public equal(entity: StatEntity): boolean {
        return entity.hash() === this.hash();
    }

    public select() {
        this.selected = true;
    }

    public unselect() {
        this.selected = false;
    }

    public filter(filter: string) {
        this._filter = filter.trim();
        this.hidden = this._filter === '' ? false : this.id.toLowerCase().indexOf(filter) === -1;
    }
}
