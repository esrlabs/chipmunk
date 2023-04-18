import { Key, Store, StoredEntity } from '../store';
import { ChartRequest } from './request';
import { IFilter } from '@platform/types/filter';
import { Subject } from '@platform/env/subscription';
import { ISelectEvent } from '@ui/views/sidebar/search/providers/definitions/provider';
export { ChartRequest } from './request';

export class ChartsStore extends Store<ChartRequest> {
    public chartSelected: Subject<string> = new Subject<string>();

    private _selectedGuid: string = '';

    public override destroy() {
        super.destroy();
        this.chartSelected.destroy();
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

    public getActiveCount(): number {
        return this.get().filter((request) => request.definition.active).length;
    }

    public has(request: ChartRequest): boolean {
        return this.get().find((entity) => entity.isSame(request)) !== undefined;
    }

    public select(event: ISelectEvent) {
        this._selectedGuid = event.guids[0];
        this.chartSelected.emit(event.entity === undefined ? '' : event.guids[0]);
    }

    public get selectedGuid(): string {
        return this._selectedGuid;
    }
}
