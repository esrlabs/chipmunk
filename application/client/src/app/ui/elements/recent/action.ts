import { Action } from '@service/recent/action';
import { getMatcher } from '@ui/env/globals';

export class WrappedAction {
    public readonly action: Action;
    public filtered: boolean = true;

    private _filter: string = '';
    private _htmlMajor: string;
    private _htmlMinor: string;

    constructor(action: Action) {
        this.action = action;
        this._htmlMajor = this.action.description().major;
        this._htmlMinor = this.action.description().minor;
    }

    public description(): {
        major: string;
        minor: string;
    } {
        return {
            major: this._htmlMajor,
            minor: this._htmlMinor,
        };
    }

    public hash(): string {
        return `${this.action.description().major}-${this.action.description().minor}`;
    }

    public filter(filter: string) {
        this._filter = filter.trim();
        this._htmlMajor = getMatcher().search_single(this._filter, this.action.description().major);
        this._htmlMinor = getMatcher().search_single(this._filter, this.action.description().minor);
        this.filtered =
            this._filter === ''
                ? true
                : this._htmlMajor !== this.action.description().major ||
                  this._htmlMinor !== this.action.description().minor;
    }
}
