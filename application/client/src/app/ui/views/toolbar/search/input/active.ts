import { IFilter } from '@platform/types/filter';
import { Search } from '@service/session/dependencies/search';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
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
        console.log(
            this.search
                .store()
                .filters()
                .has(new FilterRequest({ filter: this.filter })),
        );
        return !this.search
            .store()
            .filters()
            .has(new FilterRequest({ filter: this.filter }));
    }

    public isPossibleToSaveAsChart(): boolean {
        return !this.search
            .store()
            .charts()
            .has(new ChartRequest({ filter: this.filter.filter }));
    }
}
