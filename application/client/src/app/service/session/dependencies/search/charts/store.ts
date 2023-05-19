import { Key, Store, StoredEntity } from '../store';
import { ChartRequest } from './request';
import { IFilter } from '@platform/types/filter';
import { DisableConvertable } from '../disabled/converting';
import { FilterRequest } from '../filters/request';

import * as regexFilters from '@platform/env/filters';

export { ChartRequest } from './request';

export class ChartsStore extends Store<ChartRequest> {
    public key(): Key {
        return Key.filters;
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

    public isConvertableFrom(smth: StoredEntity<unknown>): boolean {
        return (
            smth instanceof FilterRequest && regexFilters.hasGroups(smth.definition.filter.filter)
        );
    }

    public tryFromFilter(smth: StoredEntity<unknown> | FilterRequest): boolean {
        if (
            smth instanceof FilterRequest &&
            regexFilters.hasGroups(smth.definition.filter.filter)
        ) {
            const def = smth.definition;
            this.update([
                new ChartRequest({
                    filter: def.filter.filter,
                    color: def.colors.background,
                    active: true,
                }) as StoredEntity<ChartRequest>,
            ]);
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
