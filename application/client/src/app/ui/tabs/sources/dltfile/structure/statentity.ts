import { LevelDistribution } from '@platform/types/parsers/dlt';
import { Subject } from '@platform/env/subscription';
import { Matcher } from '@matcher/matcher';

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

    private _matcher: Matcher = Matcher.new();
    private _html_id: string;

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
        this._html_id = id;
    }

    public get html_id(): string {
        return this._html_id;
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
        const id = this._matcher.search_single(filter, this.id);
        if (id === this.id && filter !== '') {
            this.hidden = true;
        } else {
            this.hidden = false;
            this._html_id = id;
        }
    }
}
