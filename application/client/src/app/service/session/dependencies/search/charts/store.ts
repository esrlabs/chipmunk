import { DisableConvertable } from '../disabled/converting';
import { Key, Store, StoredEntity } from '../store';
import { ChartRequest } from './request';
import { IFilter } from '@platform/types/filter';

export { ChartRequest } from './request';

export class ChartsStore extends Store<ChartRequest> {
    public override destroy() {
        super.destroy();
    }

    public key(): Key {
        return Key.charts;
    }

    public addFromFilter(filter: IFilter): void {
        const request = new ChartRequest({ filter: filter.filter });
        if (this.has(request)) {
            return;
        }
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

    public has(request: ChartRequest): boolean {
        return this.get().find((entity) => entity.isSame(request)) !== undefined;
    }
}
