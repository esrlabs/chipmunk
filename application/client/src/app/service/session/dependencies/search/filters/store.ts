import { DisableConvertable } from '../disabled/converting';
import { Key, Store, StoredEntity } from '../store';
import { FilterRequest } from './request';
import { IFilter } from '@platform/types/filter';

export { FilterRequest } from './request';

export class FiltersStore extends Store<FilterRequest> {
    public key(): Key {
        return Key.filters;
    }

    public addFromFilter(filter: IFilter): void {
        const request = new FilterRequest({ filter });
        if (this.has(request)) {
            return;
        }
        this.update([request as StoredEntity<FilterRequest>]);
    }

    public tryRestore(smth: DisableConvertable): boolean {
        if (smth instanceof FilterRequest) {
            this.update([smth as StoredEntity<FilterRequest>]);
            return true;
        } else {
            return false;
        }
    }

    public getActiveCount(): number {
        return this.get().filter((request) => request.definition.active).length;
    }

    public has(request: FilterRequest): boolean {
        return this.get().find((entity) => entity.isSame(request)) !== undefined;
    }
}
