import {
    Component,
    Input,
    OnDestroy,
    AfterContentInit,
    ChangeDetectorRef,
    ElementRef,
    ChangeDetectionStrategy,
    ViewChild,
    AfterViewInit,
    HostListener,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
    ControllerSessionTabMap,
    IMapPoint,
    IMapState,
    IMap,
} from '../../../../controller/session/dependencies/map/controller.session.tab.map';
import { FilterRequest } from '../../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.storage';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { EParent } from '../../../../services/standalone/service.output.redirections';

import ContextMenuService from '../../../../services/standalone/service.contextmenu';
import ViewsEventsService from '../../../../services/standalone/service.views.events';
import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-content-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewContentMapComponent implements OnDestroy, AfterContentInit, AfterViewInit {
    @ViewChild('canvas') _ng_canvas!: ElementRef;

    @Input() service!: ControllerSessionTabMap;

    public _ng_width: number = 0;
    public _ng_height: number = 0;
    public _ng_cursor_height: string = '0px';
    public _ng_cursor_top: string = '0px';

    private _state: IMapState = {
        count: 0,
        position: 0,
        rowsInView: 0,
    };
    private _map: IMap = {
        columns: 0,
        points: [],
    };
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger(`ViewContentMapComponent`);

    @HostListener('contextmenu', ['$event']) public _ng_onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: this.service.isExpanded() ? 'Abridge Filters' : 'Expand Filters',
                handler: () => {
                    this.service.expanding();
                    this._onRepaint();
                },
            },
            {
                /* Delimiter */
            },
            {
                caption: this.service.isColumnsWide() ? 'Narrower Columns' : 'Wider Columns',
                handler: () => {
                    this.service.toggleColumnWidth();
                    this._onRepaint();
                },
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
    }

    @HostListener('click', ['$event']) public _ng_onClick(event: MouseEvent) {
        let row: number = Math.ceil((this._state.count / this._ng_height) * event.offsetY);
        if (row > this._state.count - 1) {
            row = this._state.count - 1;
        }
        OutputRedirectionsService.select(EParent.marker, this.service.getGuid(), { output: row });
    }

    @HostListener('dblclick', ['$event']) public _ng_onDblClick(event: MouseEvent) {
        this.service.expanding();
        this._onRepaint();
    }

    constructor(private _cdRef: ChangeDetectorRef, private _elRef: ElementRef) {}

    public ngAfterContentInit() {
        this._subscriptions.onMapRecalculated = this.service
            .getObservable()
            .onMapRecalculated.subscribe(this._onMapRecalculated.bind(this));
        this._subscriptions.onUpdateStateSubject = this.service
            .getObservable()
            .onStateUpdate.subscribe(this._onUpdateState.bind(this));
        this._subscriptions.onPositionUpdateSubject = this.service
            .getObservable()
            .onPositionUpdate.subscribe(this._onPositionUpdate.bind(this));
        this._subscriptions.onRepaintSubject = this.service
            .getObservable()
            .onRepaint.subscribe(this._onRepaint.bind(this, false));
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._onRepaint.bind(this, true),
        );
        this._subscriptions.onRestyleSubject = this.service
            .getObservable()
            .onRestyle.subscribe(this._onRestyle.bind(this));
        this._setState(this.service.getState());
    }

    public ngAfterViewInit() {
        this._setHeight();
        this.service.requestMapCalculation(this._ng_height, true);
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
        this.service.requestMapCalculation(this._ng_height, false);
        this._updateCursor();
        this._forceUpdate();
        this.service.repainted();
    }

    private _onMapRecalculated(map: IMap) {
        this._map = map;
        this._draw();
    }

    private _onRestyle(request: FilterRequest) {
        const desc = request.asDesc();
        this._map.points = this._map.points.map((point: IMapPoint) => {
            if (point.reg !== desc.request) {
                return point;
            }
            point.color = desc.background;
            return point;
        });
        this._draw();
    }

    private _draw() {
        const width = (columns: number) => {
            this._ng_width = this.service.getColumnWidth() * columns;
            this._forceUpdate();
        };
        const draw = (points: IMapPoint[]) => {
            if (this._ng_canvas === undefined || this.service === undefined) {
                return;
            }
            const context: CanvasRenderingContext2D | null = (
                this._ng_canvas.nativeElement as HTMLCanvasElement
            ).getContext('2d');
            if (context === null) {
                this._logger.error(`Fail to create 2D context of CANVAS`);
                return;
            }
            // Drop background
            context.fillStyle = 'rgb(0,0,0)';
            context.fillRect(0, 0, this._ng_width, this._ng_height);
            // Drawing markers
            let height: number = this._ng_height / this.service.getStreamLength();
            height =
                height < this.service.getSettings().minMarkerHeight
                    ? this.service.getSettings().minMarkerHeight
                    : height;
            const done: { [key: string]: boolean } = {};
            points.forEach((point: IMapPoint) => {
                const x: number =
                    this._ng_width - this.service.getColumnWidth() * (1 + point.column);
                const y: number = Math.ceil(point.position) * height - height;
                const key: string = y + '-' + x;
                if (done[key]) {
                    return;
                }
                context.fillStyle = point.color === '' ? 'rgb(255,0,0)' : point.color;
                done[key] = true;
                context.fillRect(x - 1, y, this.service.getColumnWidth() - 1, height);
            });
        };
        width(this._map.columns);
        draw(this._map.points);
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
