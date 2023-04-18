import { IFilter } from '@platform/types/filter';
import { Search } from '@service/session/dependencies/search';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';

interface IPossibleToSaveAs {
    filter: boolean;
    chart: boolean;
}

export class ActiveSearch {
    public filter: IFilter;
    protected readonly search: Search;

    private _isPossibleToSaveAs: IPossibleToSaveAs;

    constructor(search: Search, filter: IFilter) {
        this.filter = filter;
        this.search = search;
        this._isPossibleToSaveAs = {
            filter: true,
            chart: ChartRequest.isValid(this.filter.filter),
        };
    }

    public apply(): Promise<number> {
        return this.search.state().setActive(this.filter);
    }

    public isPossibleToSaveAsFilter(): boolean {
        const request = new FilterRequest({ filter: this.filter });
        return (
            !this.search.store().filters().has(request) &&
            !this.search.store().disabled().has(new DisabledRequest(request))
        );
    }

    public get isPossibleToSaveAs(): IPossibleToSaveAs {
        return this._isPossibleToSaveAs;
    }
}
