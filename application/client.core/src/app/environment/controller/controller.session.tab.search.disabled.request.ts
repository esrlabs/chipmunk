import { FilterRequest } from './controller.session.tab.search.filters.request';
import { ChartRequest } from './controller.session.tab.search.charts.request';
import { RangeRequest } from './controller.session.tab.search.ranges.request';
import { IDisabledEntitySupport } from './controller.session.tab.search.disabled.support';

export interface IDesc {
    type: string;
    desc: any;
}

export class DisabledRequest {

    private _entity: IDisabledEntitySupport;
    private _guid: string;

    constructor(entity: IDisabledEntitySupport) {
        let found: boolean = false;
        [FilterRequest, ChartRequest, RangeRequest].forEach((classRef) => {
            if (entity instanceof classRef) {
                found = true;
            }
        });
        if (!found) {
            throw new Error(`Fail to find a class for entity: ${typeof entity}`);
        }
        this._entity = entity;
        this._guid = entity.getGUID();
    }

    public destroy() {
    }

    public getEntity(): IDisabledEntitySupport {
        return this._entity;
    }

    public getGUID(): string {
        return this._guid;
    }

    public asDesc(): IDesc {
        return {
            type: this.getEntity().getTypeRef(),
            desc: this.getEntity().asDesc(),
        };
    }

}
