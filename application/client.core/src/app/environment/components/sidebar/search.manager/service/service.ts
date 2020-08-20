import { Observable, Subject } from 'rxjs';
import { Entity } from '../providers/entity';
import { FilterRequest } from 'src/app/environment/controller/controller.session.tab.search.filters';
import { ChartRequest } from 'src/app/environment/controller/controller.session.tab.search.charts.request';
import { DisabledRequest } from 'src/app/environment/controller/controller.session.tab.search.disabled';
import { RangeRequest } from 'src/app/environment/controller/controller.session.tab.search.ranges';

export type TRequest = FilterRequest | ChartRequest | DisabledRequest | RangeRequest;

export class SearchManagerService {

    private _dragging: Entity<TRequest>;

    private _subjects = {
        remove: new Subject<void>(),
        drag: new Subject<boolean>(),
    };

    public getObservable(): {
        remove: Observable<void>,
        drag: Observable<boolean>,
    } {
        return {
            remove: this._subjects.remove.asObservable(),
            drag: this._subjects.drag.asObservable(),
        };
    }

    public onBinDrop() {
        this._subjects.remove.next();
    }
    public onDragStart(status: boolean, entity?: Entity<TRequest>) {
        this._subjects.drag.next(status);
        this._dragging = entity;
    }

    public getDragging(): Entity<TRequest> {
        return this._dragging;
    }

}

export default (new SearchManagerService());
