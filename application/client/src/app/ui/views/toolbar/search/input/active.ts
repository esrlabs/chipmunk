import { IFilter } from '@platform/types/filter';
import { Search } from '@service/session/dependencies/search';

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
        return true;
    }

    public isPossibleToSaveAsChart(): boolean {
        return false;
    }
}
