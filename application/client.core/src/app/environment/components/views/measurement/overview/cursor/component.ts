import { Component, HostListener, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterContentInit, EventEmitter, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { DataService } from '../../service.data';

import ViewsEventsService from '../../../../../services/standalone/service.views.events';
import EventsSessionService from '../../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

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
    selector: 'app-views-measurement-overview-cursor',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewMeasurementOverviewCursorComponent implements AfterContentInit, AfterViewInit, OnDestroy {

    @Input() service: DataService;

    public _ng_width: number = -1;
    public _ng_left: number = 0;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementOverviewCursorComponent');
    private _width: number = -1;
    private _mouse: {
        x: number,
        kind: EChangeKind,
    } = {
        x: -1,
        kind: EChangeKind.undefined,
    };
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
        this._onWindowMousemove = this._onWindowMousemove.bind(this);
        this._onWindowMouseup = this._onWindowMouseup.bind(this);
        window.addEventListener('mousemove', this._onWindowMousemove);
        window.addEventListener('mouseup', this._onWindowMouseup);
    }

    @HostListener('wheel', ['$event']) _ng_onWheel(event: WheelEvent) {
        this._forceUpdate();
        this._ng_preventDefault(event);
    }

    @HostListener('click', ['$event']) _ng_onClick(event: MouseEvent) {
        this._forceUpdate();
    }

    public ngAfterContentInit() {
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
        this._subscriptions.zoom = this.service.getObservable().zoom.subscribe(
            this._onChartDataZoom.bind(this),
        );
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._resize.bind(this),
        );
    }

    public ngAfterViewInit() {
        this._resize();
        this._update();
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

    public _ng_preventDefault(event: MouseEvent) {
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
        return false;
    }

    private _onSessionChange() {

    }

    private _onChartDataZoom() {
        this._update();
    }

    private _resize() {
        const rect = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        this._width = rect.width;
    }

    private _update() {
        if (this.service === undefined) {
            return;
        }
        const state = this.service.getCursorState();
        const r = state.duration / this._width;
        if (isNaN(r) || !isFinite(r)) {
            return;
        }
        this._ng_left = state.left / r;
        this._ng_width = Math.abs(state.duration - state.left - state.right) / r;
        this._forceUpdate();
    }
/*
    private _resize() {
        if (this._vcRef === undefined) {
            return;
        }
        if (!this.serviceData.hasData()) {
            this._ng_width = -1;
            this._width = -1;
            this._forceUpdate();
            return;
        }
        const size: ClientRect = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        const width: number = size.width - this.getLeftOffset();
        if (width <= 0 || isNaN(width) || !isFinite(width)) {
            return;
        }
        if (this._ng_width === -1) {
            this._ng_width = width;
            this._ng_left = 0;
        }
        if (this._width === width) {
            this._emitChanges();
            return;
        }
        if (this._width === -1) {
            this._width = Math.round(width);
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
        this._emitChanges();
        this._forceUpdate();
    }
*/
    private _onWindowMousemove(event: MouseEvent) {
        if (this._mouse.x === -1) {
            return;
        }
        const state = this.service.getCursorState();
        const r = state.duration / this._width;
        const offset: number = event.x - this._mouse.x;
        this._mouse.x = event.x;
        switch (this._mouse.kind) {
            case EChangeKind.move:
                if (this._ng_left + offset < 0) {
                    this._ng_left = 0;
                } else if (this._ng_width + this._ng_left + offset > this._width) {
                    this._ng_left = this._width - this._ng_width;
                } else {
                    this._ng_left += offset;
                }
                break;
            case EChangeKind.left:
                if (this._ng_left + offset < 0) {
                    this._ng_left = 0;
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
                } else if (this._ng_left + this._ng_width + offset > this._width) {
                    this._ng_width = this._width - this._ng_left;
                } else {
                    this._ng_width += offset;
                }
                break;
        }
        this.service.setZoomOffsets(this._ng_left * r, (this._width - (this._ng_left + this._ng_width)) * r);
        // this._forceUpdate();
    }

    private _onWindowMouseup(event: MouseEvent) {
        if (this._mouse.x === -1) {
            return;
        }
        this._mouse.x = -1;
        this._mouse.kind = EChangeKind.undefined;
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
