import { FilterRequest } from './controller.session.tab.search.filters.request';

import * as Toolkit from 'chipmunk.client.toolkit';

export class TimeRange {

    private _start: FilterRequest;
    private _end: FilterRequest;
    private _guid: string = Toolkit.guid();

    constructor(start: FilterRequest, end: FilterRequest) {
        this._start = start;
        this._end = end;
    }

    public getGUID(): string {
        return this._guid;
    }

    public getFilters(): FilterRequest[] {
        return [this._start, this._end];
    }

}
