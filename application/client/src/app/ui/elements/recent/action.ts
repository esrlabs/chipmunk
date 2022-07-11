import { Action } from '@service/recent/action';
import { getMatcher } from '@ui/env/globals';

export class WrappedAction {
    public readonly action: Action;
    public filtered: boolean = true;

    private _filter: string = '';
    private _html_major: string;
    private _html_minor: string;

    constructor(action: Action) {
        this.action = action;
        this._html_major = this.action.description().major;
        this._html_minor = this.action.description().minor;
    }

    public description(): {
        major: string;
        minor: string;
    } {
        return {
            major: this._html_major,
            minor: this._html_minor,
        };
    }

    public filter(filter: string) {
        this._filter = filter.trim();
        this._html_major = getMatcher().search_single(
            this._filter,
            this.action.description().major,
        );
        this._html_minor = getMatcher().search_single(
            this._filter,
            this.action.description().minor,
        );
        this.filtered =
            this._filter === ''
                ? true
                : this._html_major !== this.action.description().major ||
                  this._html_minor !== this.action.description().minor;
    }
}
