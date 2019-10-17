import { Component, HostListener, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterContentInit, EventEmitter, Input } from '@angular/core';
import { Observable, Subscription, of } from 'rxjs';
import { IPositionChange } from '../../service.position';
import * as Toolkit from 'logviewer.client.toolkit';
import ViewsEventsService from '../../../../../services/standalone/service.views.events';
import { ServiceData } from '../../service.data';
import { ServicePosition } from '../../service.position';

enum EChangeKind {
    move = 'move',
    left = 'left',
    right = 'right',
    undefined = 'undefined'
}

const CSettings = {
    minSize: 20,
};

@Component({
    selector: 'app-views-chart-zoomer-cursor-canvas',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewChartZoomerCursorCanvasComponent implements AfterContentInit, AfterViewInit, OnDestroy {

    @Input() serviceData: ServiceData;
    @Input() servicePosition: ServicePosition;
    @Input() onOffsetUpdated: EventEmitter<void>;


    public _ng_width: number = -1;
    public _ng_left: number = 0;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewChartZoomerCursorCanvasComponent');
    private _width: number = -1;
    private _mouse: {
        x: number,
        kind: EChangeKind,
    } = {
        x: -1,
        kind: EChangeKind.undefined,
    };
    private _destroyed: boolean = false;

    @Input() getLeftOffset: () => number = () => 0;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
        this._onWindowMousemove = this._onWindowMousemove.bind(this);
        this._onWindowMouseup = this._onWindowMouseup.bind(this);
        window.addEventListener('mousemove', this._onWindowMousemove);
        window.addEventListener('mouseup', this._onWindowMouseup);
    }

    @HostListener('wheel', ['$event']) _ng_onWheel(event: WheelEvent) {
        if (this._ng_width === -1 || this._width === -1) {
            return;
        }
        let x: number = event.offsetX;
        if ((event.target as HTMLElement).className === 'cursor') {
            x += this._ng_left;
        }
        let width: number = this._ng_width;
        if (event.deltaY > 0) {
            // Zoom in
            if (width - event.deltaY < CSettings.minSize) {
                width = CSettings.minSize;
            } else {
                width -= event.deltaY;
            }
        } else if (event.deltaY < 0) {
            // Zoom out
            if (width - event.deltaY > this._width) {
                width = this._width;
            } else {
                width -= event.deltaY;
            }
        }
        let left: number = x - Math.round(width / 2);
        if (left < 0) {
            left = 0;
        }
        if (left + width > this._width) {
            left = this._width - width;
        }
        this._ng_width = width;
        this._ng_left = left;
        this._emitChanges();
        this._forceUpdate();
    }

    public ngAfterContentInit() {
        const position: IPositionChange | undefined = this.servicePosition.get();
        if (position === undefined) {
            return;
        }
        this._ng_left = position.l;
        this._ng_width = position.w;
    }

    public ngAfterViewInit() {
        // Cursor events
        this._subscriptions.onSwitch = this.servicePosition.getObservable().onSwitch.subscribe(this._onPositionRestored.bind(this));
        // Data events
        this._subscriptions.onData = this.serviceData.getObservable().onData.subscribe(this._onResizeIsRequired.bind(this));
        // Listen session changes event
        this._subscriptions.onViewResize = ViewsEventsService.getObservable().onResize.subscribe(this._onResizeIsRequired.bind(this));
        // Listen offset changes
        this._subscriptions.onOffsetUpdated = this.onOffsetUpdated.subscribe(this._onResizeIsRequired.bind(this));
        // Update width
        this._resize();
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        window.removeEventListener('mousemove', this._onWindowMousemove);
        window.removeEventListener('mouseup', this._onWindowMouseup);
    }

    public _ng_onMove(event: MouseEvent) {
        if (this._ng_width >= this._width) {
            return;
        }
        this._mouse.x = event.x;
        this._mouse.kind = EChangeKind.move;
    }

    public _ng_onLeft(event: MouseEvent) {
        this._mouse.x = event.x;
        this._mouse.kind = EChangeKind.left;
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    public _ng_onRight(event: MouseEvent) {
        this._mouse.x = event.x;
        this._mouse.kind = EChangeKind.right;
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    private _resize() {
        if (this._vcRef === undefined) {
            return;
        }
        if (!this.serviceData.hasData()) {
            this._ng_width = -1;
            this._forceUpdate();
            return;
        }
        const size: ClientRect = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        const width: number = size.width - this.getLeftOffset();
        if (width <= 0 || isNaN(width) || !isFinite(width)) {
            return;
        }
        if (this._width === width) {
            return;
        }
        if (this._width === -1) {
            this._width = Math.round(width);
        }
        if (this._ng_width === -1) {
            this._ng_width = width;
        }
        if (this._ng_left < this.getLeftOffset()) {
            this._ng_left = this.getLeftOffset();
        }
        const change: number = this._width / width;
        // Get rate for current values
        const rate: number = this._ng_width / this._width;
        // Update width
        this._width = Math.round(width);
        // Calculate updated width of cursor
        this._ng_width = width * rate;
        this._ng_left = (this._ng_left - this.getLeftOffset()) / change + this.getLeftOffset();
        this._forceUpdate();
    }

    private _onWindowMousemove(event: MouseEvent) {
        if (this._mouse.x === -1) {
            return;
        }
        const offset: number = event.x - this._mouse.x;
        const left: number = this._ng_left - this.getLeftOffset();
        this._mouse.x = event.x;
        switch (this._mouse.kind) {
            case EChangeKind.move:
                if (left + offset < 0) {
                    this._ng_left = this.getLeftOffset();
                } else if (this._ng_width + left + offset > this._width) {
                    this._ng_left = this._width - this._ng_width + this.getLeftOffset();
                } else {
                    this._ng_left += offset;
                }
                break;
            case EChangeKind.left:
                if (left + offset < 0) {
                    this._ng_left = this.getLeftOffset();
                } else if (this._ng_width - offset < CSettings.minSize) {
                    //
                } else {
                    this._ng_left += offset;
                    this._ng_width -= offset;
                }
                break;
            case EChangeKind.right:
                if (this._ng_width + offset < CSettings.minSize) {
                    this._ng_width = CSettings.minSize;
                } else if (left + this._ng_width + offset > this._width) {
                    this._ng_width = this._width - left;
                } else {
                    this._ng_width += offset;
                }
                break;
        }
        this._emitChanges();
        this._forceUpdate();
    }

    private _onWindowMouseup(event: MouseEvent) {
        if (this._mouse.x === -1) {
            return;
        }
        this._mouse.x = -1;
        this._mouse.kind = EChangeKind.undefined;
    }

    private _emitChanges() {
        // Always round values, because it will go to service.data. Based on pixels will be calculated range of rows
        // only 1 px offset can make more than 100 rows offset in range. It will change scale.
        this._ng_width = Math.round(this._ng_width);
        this._ng_left = Math.round(this._ng_left);
        const _left: number = this._ng_left - this.getLeftOffset();
        this.servicePosition.set({
            left: _left < 0 ? 0 : _left,
            width: this._ng_width,
            full: this._width,
            w: this._ng_width,
            l: this._ng_left,
        });
    }

    private _onResizeIsRequired() {
        this._resize();
    }

    private _onPositionRestored(position: IPositionChange) {
        if (position.l === undefined || position.w === undefined) {
            return;
        }
        this._ng_left = position.l;
        this._ng_width = position.w;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
