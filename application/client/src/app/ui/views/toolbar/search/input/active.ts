import { IFilter } from '@platform/types/filter';
import { Search } from '@service/session/dependencies/search';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';

export class ActiveSearch {
    public filter: IFilter;
    protected readonly search: Search;

    constructor(search: Search, filter: IFilter) {
        this.filter = filter;
        this.search = search;
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

    public isPossibleToSaveAsChart(): boolean {
        const request = new ChartRequest({ filter: this.filter.filter });
        return (
            !this.search.store().charts().has(request) &&
            !this.search.store().disabled().has(new DisabledRequest(request))
        );
    }
}
