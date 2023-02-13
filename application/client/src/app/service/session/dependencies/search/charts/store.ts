import { Key, Store, StoredEntity } from '../store';
import { ChartRequest } from './request';
import { IFilter } from '@platform/types/filter';
import { DisableConvertable } from '../disabled/converting';

export { ChartRequest } from './request';

export class ChartsStore extends Store<ChartRequest> {
    public key(): Key {
        return Key.filters;
    }

    public addFromFilter(filter: IFilter): void {
        const request = new ChartRequest({ filter: filter.filter });
        this.update([request as StoredEntity<ChartRequest>]);
    }

    public tryRestore(smth: DisableConvertable): boolean {
        if (smth instanceof ChartRequest) {
            this.update([smth as StoredEntity<ChartRequest>]);
            return true;
        } else {
            return false;
        }
    }

    public getActiveCount(): number {
        return this.get().filter((request) => request.definition.active).length;
    }
}
