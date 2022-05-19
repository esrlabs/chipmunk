import { Action } from '@service/recent/action';
import { wrapMatchesToHtml } from '@ui/env/globals';

export class WrappedAction {
    public readonly action: Action;
    public filtered: boolean = true;
    private _filter: string = '';

    constructor(action: Action) {
        this.action = action;
    }

    public description(): {
        major: string;
        minor: string;
    } {
        return {
            major:
                this._filter.length === 0
                    ? this.action.description().major
                    : wrapMatchesToHtml(this._filter, this.action.description().major, 'span'),
            minor:
                this._filter.length === 0
                    ? this.action.description().minor
                    : wrapMatchesToHtml(this._filter, this.action.description().minor, 'span'),
        };
    }

    public filter(filter: string) {
        this._filter = filter.trim().toLowerCase();
        this.filtered =
            this.action.description().major.toLowerCase().indexOf(this._filter) !== -1 ||
            this.action.description().minor.toLowerCase().indexOf(this._filter) !== -1;
    }
}
