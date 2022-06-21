import { IFilter } from '@platform/types/filter';

export class ActiveSearch {
    public filter: IFilter;

    constructor(filter: IFilter) {
        this.filter = filter;
    }

    public isPossibleToSaveAsFilter(): boolean {
        return true;
    }

    public isPossibleToSaveAsChart(): boolean {
        return false;
    }
}
