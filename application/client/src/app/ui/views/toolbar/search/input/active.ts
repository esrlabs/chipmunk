import { IFilter, IFilterFlags } from '@platform/types/filter';

export class ActiveSearch {
    public filter: IFilter;

    constructor(filter: IFilter) {
        this.filter = filter;
    }

    public isPossibleToSaveAsFilter(): boolean {
        return false;
    }

    public isPossibleToSaveAsChart(): boolean {
        return false;
    }
}
