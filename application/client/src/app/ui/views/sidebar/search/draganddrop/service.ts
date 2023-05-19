import { Subject, unsubscribeAllInHolder } from '@platform/env/subscription';
import { Entity } from '../providers/definitions/entity';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';

export type DragableRequest = FilterRequest | ChartRequest | DisabledRequest;

export enum ListContent {
    filtersList = 'filtersList',
    chartsList = 'chartsList',
    disabledList = 'disabledList',
    rangesList = 'rangesList',
    binList = 'binList',
}

export class DragAndDropService {
    private _dragging!: Entity<DragableRequest>;
    private _droppedOut!: boolean;
    private _ignore: boolean | undefined;

    public readonly subjects: {
        remove: Subject<void>;
        drag: Subject<boolean>;
        mouseOver: Subject<ListContent>;
        mouseOverBin: Subject<boolean>;
        mouseOverGlobal: Subject<void>;
    } = {
        remove: new Subject<void>(),
        drag: new Subject<boolean>(),
        mouseOver: new Subject<ListContent>(),
        mouseOverBin: new Subject<boolean>(),
        mouseOverGlobal: new Subject<void>(),
    };

    public destroy() {
        unsubscribeAllInHolder(this.subjects);
    }

    public onBinDrop() {
        this.subjects.remove.emit();
    }

    public onDragStart(status: boolean, entity?: Entity<DragableRequest>) {
        this.subjects.drag.emit(status);
        if (entity !== undefined) {
            this._dragging = entity;
        }
    }

    public onMouseOver(listID: ListContent) {
        console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>> onMouseOver: IGNORE`);
        this._ignore = true;
        this._droppedOut = false;
        this.subjects.mouseOver.emit(listID);
    }

    public onMouseOverBin(status: boolean) {
        this.subjects.mouseOverBin.emit(status);
    }

    public onMouseOverGlobal() {
        if (!this._ignore) {
            this._droppedOut = true;
        } else {
            this._ignore = false;
        }
        this.subjects.mouseOverGlobal.emit();
    }

    public get dragging(): Entity<DragableRequest> {
        return this._dragging;
    }

    get droppedOut(): boolean {
        return this._droppedOut;
    }
}
