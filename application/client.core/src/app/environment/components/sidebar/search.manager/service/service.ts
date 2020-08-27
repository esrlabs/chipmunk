import { Observable, Subject } from 'rxjs';
import { Entity } from '../providers/entity';
import { FilterRequest } from 'src/app/environment/controller/controller.session.tab.search.filters';
import { ChartRequest } from 'src/app/environment/controller/controller.session.tab.search.charts.request';
import { DisabledRequest } from 'src/app/environment/controller/controller.session.tab.search.disabled';
import { RangeRequest } from 'src/app/environment/controller/controller.session.tab.search.ranges';

export type TRequest = FilterRequest | ChartRequest | DisabledRequest | RangeRequest;

export enum EListID {
    filtersList = 'filtersList',
    chartsList = 'chartsList',
    disabledList = 'disabledList',
    rangesList = 'rangesList',
    binList = 'binList'
}

export class SearchManagerService {

    private _dragging: Entity<TRequest>;

    private _subjects = {
        remove: new Subject<void>(),
        drag: new Subject<boolean>(),
        mouseOver: new Subject<EListID>(),
        mouseOverBin: new Subject<boolean>(),
        mouseOverGlobal: new Subject<void>(),
    };

    public getObservable(): {
        remove: Observable<void>,
        drag: Observable<boolean>,
        mouseOver: Observable<EListID>,
        mouseOverBin: Observable<boolean>,
        mouseOverGlobal: Observable<void>,
    } {
        return {
            remove: this._subjects.remove.asObservable(),
            drag: this._subjects.drag.asObservable(),
            mouseOver: this._subjects.mouseOver.asObservable(),
            mouseOverBin: this._subjects.mouseOverBin.asObservable(),
            mouseOverGlobal: this._subjects.mouseOverGlobal.asObservable(),
        };
    }

    public onBinDrop() {
        this._subjects.remove.next();
    }

    public onDragStart(status: boolean, entity?: Entity<TRequest>) {
        this._subjects.drag.next(status);
        this._dragging = entity;
    }

    public onMouseOver(listID: EListID) {
        this._subjects.mouseOver.next(listID);
    }

    public onMouseOverBin(status: boolean) {
        this._subjects.mouseOverBin.next(status);
    }

    public onMouseOverGlobal() {
        this._subjects.mouseOverGlobal.next();
    }

    public getDragging(): Entity<TRequest> {
        return this._dragging;
    }

}

export default (new SearchManagerService());
