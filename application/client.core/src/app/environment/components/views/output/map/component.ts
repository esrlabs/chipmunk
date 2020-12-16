import { Component, Input, OnDestroy, AfterContentInit, ChangeDetectorRef, ElementRef, ViewChild, AfterViewInit, HostBinding, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { ControllerSessionTabMap, IMapPoint, IMapState } from '../../../../controller/session/dependencies/map/controller.session.tab.map';
import { FilterRequest } from '../../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.storage';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { EParent } from '../../../../services/standalone/service.output.redirections';

import ContextMenuService from '../../../../services/standalone/service.contextmenu';
import ViewsEventsService from '../../../../services/standalone/service.views.events';
import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';


@Component({
    selector: 'app-views-content-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewContentMapComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    @ViewChild('canvas') _ng_canvas: ElementRef;

    @Input() service: ControllerSessionTabMap;

    @HostBinding('style.width') width = '0px';

    public _ng_width: number = 0;
    public _ng_height: number = 0;
    public _ng_cursor_height: string = '0px';
    public _ng_cursor_top: string = '0px';

    private _state: IMapState = {
        count: 0,
        position: 0,
        rowsInView: 0,
        points: [],
    };
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    @HostListener('contextmenu', ['$event']) public _ng_onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: this.service.isExpanded() ? 'Abridge Filters' : 'Expand Filters',
                handler: () => {
                    this.service.toggleExpanding();
                }
            },
            { /* Delimiter */ },
            {
                caption: this.service.isColumnsWide() ? 'Narrower Columns' : 'Wider Columns',
                handler: () => {
                    this.service.toggleColumnWidth();
                    this._onRepaint();
                }
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
    }

    @HostListener('click', ['$event']) public _ng_onClick(event: MouseEvent) {
        let row: number = Math.ceil((this._state.count / this._ng_height ) * event.offsetY);
        if (row > this._state.count - 1) {
            row = this._state.count - 1;
        }
        OutputRedirectionsService.select(EParent.marker, this.service.getGuid(), row);
    }

    @HostListener('dblclick', ['$event']) public _ng_onDblClick(event: MouseEvent) {
        this.service.toggleExpanding();
    }

    constructor(private _cdRef: ChangeDetectorRef,
                private _elRef: ElementRef) {
    }

    public ngAfterContentInit() {
        this._subscriptions.onUpdateStateSubject = this.service.getObservable().onStateUpdate.subscribe(this._onUpdateState.bind(this));
        this._subscriptions.onPositionUpdateSubject = this.service.getObservable().onPositionUpdate.subscribe(this._onPositionUpdate.bind(this));
        this._subscriptions.onRepaintSubject = this.service.getObservable().onRepaint.subscribe(this._onRepaint.bind(this));
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(this._onRepaint.bind(this, true));
        this._subscriptions.onRestyleSubject = this.service.getObservable().onRestyle.subscribe(this._onRestyle.bind(this));
        this._setState(this.service.getState());
        this._onRepaint();
    }

    public ngAfterViewInit() {
        this._setHeight();
        this._setWidth();
        this._draw();
        this._forceUpdate();
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _setState(state: IMapState) {
        this._state.count = state.count;
        this._state.points = state.points;
        this._state.position = state.position;
        this._state.rowsInView = state.rowsInView;
    }

    private _setHeight(): boolean {
        const size: ClientRect = (this._elRef.nativeElement as HTMLElement).getBoundingClientRect();
        if (size.height <= 0) {
            return false;
        }
        if (this._ng_height === size.height) {
            return false;
        }
        this._ng_height = size.height;
        return true;
    }

    private _setWidth() {
        if (this.service === undefined) {
            return;
        }
        this._ng_width = this.service.getColumnWidth() * this.service.getColumnsCount();
        this.width = `${this._ng_width}px`;
    }

    private _onUpdateState(state: IMapState) {
        this._setState(state);
        this._onRepaint();
    }

    private _onPositionUpdate(state: IMapState) {
        this._setState(state);
        this._updateCursor();
        this._forceUpdate();
    }

    private _onRepaint(resizing: boolean = false) {
        if (!this._setHeight() && resizing) {
            return;
        }
        this._setWidth();
        this._updateCursor();
        this._forceUpdate();
        this._draw();
        this.service.repainted();
    }

    private _onRestyle(request: FilterRequest) {
        const desc = request.asDesc();
        this._state.points = this._state.points.map((point: IMapPoint) => {
            if (point.reg !== desc.request) {
                return point;
            }
            point.color = desc.background;
            return point;
        });
        this._draw();
    }

    private _draw() {
        if (this._ng_canvas === undefined) {
            return;
        }
        const context: CanvasRenderingContext2D = (this._ng_canvas.nativeElement as HTMLCanvasElement).getContext('2d');
        // Drop background
        context.fillStyle = 'rgb(0,0,0)';
        context.fillRect(0, 0, this._ng_width, this._ng_height);
        // Drawing markers
        const rate: number = this._ng_height / this._state.count;
        const height: number = this.service.getSettings().minMarkerHeight * rate;
        if (this._ng_height < this._state.count) {
            const done: {[key: string]: boolean} = {};
            this._state.points.forEach((point: IMapPoint) => {
                const x: number = this._ng_width - this.service.getColumnWidth() * (1 + point.column);
                const y: number = Math.ceil(point.position * rate);
                const key: string = y + '-' + x;
                if (done[key]) {
                    return;
                }
                context.fillStyle = point.color === '' ? 'rgb(255,0,0)' : point.color;
                done[key] = true;
                context.fillRect(
                    x - 1,
                    y,
                    this.service.getColumnWidth() - 1,
                    height < this.service.getSettings().minMarkerHeight ? this.service.getSettings().minMarkerHeight : height
                );
            });
        } else {
            this._state.points.forEach((point: IMapPoint) => {
                context.fillStyle = point.color === '' ? 'rgb(255,0,0)' : point.color;
                const x: number = this._ng_width - this.service.getColumnWidth() * (1 + point.column);
                const y: number = point.position * rate;
                context.fillRect(
                    x - 1,
                    y,
                    this.service.getColumnWidth() - 1,
                    height < this.service.getSettings().minMarkerHeight ? this.service.getSettings().minMarkerHeight : height
                );
            });
        }
    }

    private _updateCursor() {
        const rate: number = this._ng_height / this._state.count;
        const height: number = this._state.rowsInView * rate;
        this._ng_cursor_height = `${height < 1 ? 1 : height}px`;
        this._ng_cursor_top = `${this._state.position * rate}px`;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
