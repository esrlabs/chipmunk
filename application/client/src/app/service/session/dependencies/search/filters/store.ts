import { Key, Store } from '../store';
import { FilterRequest } from './request';
import { IFilter } from '@platform/types/filter';
import { DisableConvertable } from '../disabled/converting';

export { FilterRequest } from './request';

export class FiltersStore extends Store<FilterRequest> {
    public key(): Key {
        return Key.filters;
    }

    public addFromFilter(filter: IFilter): void {
        const request = new FilterRequest({ filter });
        this.update([request]);
    }

    public tryRestore(smth: DisableConvertable): boolean {
        if (smth instanceof FilterRequest) {
            this.update([smth]);
            return true;
        } else {
            return false;
        }
    }
}
