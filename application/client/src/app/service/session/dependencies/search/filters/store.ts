import { Key, Store } from '../store';
import { FilterRequest } from './request';

export { FilterRequest } from './request';

export class FiltersStore extends Store<FilterRequest> {
    public key(): Key {
        return Key.filters;
    }
}
