import { IFilter } from '@platform/types/filter';
import { Search } from '@service/session/dependencies/search';
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

    public get isPossibleToSaveAs(): IPossibleToSaveAs {
        return this._isPossibleToSaveAs;
    }
}
