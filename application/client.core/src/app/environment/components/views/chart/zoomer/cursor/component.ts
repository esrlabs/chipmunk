import { Component, Output, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef, EventEmitter, Input } from '@angular/core';
import { Observable, Subscription, of } from 'rxjs';
import { IPositionChange } from '../../service.position';
import * as Toolkit from 'logviewer.client.toolkit';
import ViewsEventsService from '../../../../../services/standalone/service.views.events';
import { ServiceData } from '../../service.data';

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

export class ViewChartZoomerCursorCanvasComponent implements AfterViewInit, OnDestroy {

    @Output() OnChange = new EventEmitter<IPositionChange>();
    @Input() service: ServiceData;
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

    public ngAfterViewInit() {
        // Data events
        this._subscriptions.onData = this.service.getObservable().onData.subscribe(this._onResizeIsRequired.bind(this));
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
        if (!this.service.hasData()) {
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
            this._width = width;
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
        this._width = width;
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
        this.OnChange.emit({
            left: this._ng_left - this.getLeftOffset(),
            width: this._ng_width,
            full: this._width,
        });
        this._forceUpdate();
    }

    private _onWindowMouseup(event: MouseEvent) {
        if (this._mouse.x === -1) {
            return;
        }
        this._mouse.x = -1;
        this._mouse.kind = EChangeKind.undefined;
    }

    private _onResizeIsRequired() {
        this._resize();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
