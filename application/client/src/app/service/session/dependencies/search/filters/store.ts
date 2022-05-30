import { Key, Store } from '../store';
import { FilterRequest } from './request';
import { IFilter } from '@platform/types/filter';

export { FilterRequest } from './request';

export class FiltersStore extends Store<FilterRequest> {
    public key(): Key {
        return Key.filters;
    }

    public addFromFilter(filter: IFilter): void {
        const request = new FilterRequest({ filter });
        this.update([request]);
    }
}
