import {
    Component,
    HostListener,
    AfterViewInit,
    OnDestroy,
    ChangeDetectorRef,
    ViewContainerRef,
    EventEmitter,
    Input,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { IPositionChange, IPositionForce } from '../../service.position';
import { ServiceData } from '../../service.data';
import { ServicePosition } from '../../service.position';

import ViewsEventsService from '../../../../../services/standalone/service.views.events';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EChangeKind {
    move = 'move',
    left = 'left',
    right = 'right',
    undefined = 'undefined',
}

const CSettings = {
    minSize: 20,
};

@Component({
    selector: 'app-views-chart-zoomer-cursor-canvas',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ViewChartZoomerCursorCanvasComponent implements AfterViewInit, OnDestroy {
    @Input() serviceData!: ServiceData;
    @Input() servicePosition!: ServicePosition;
    @Input() onOffsetUpdated!: EventEmitter<void>;

    public _ng_width: number = -1;
    public _ng_left: number = 0;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewChartZoomerCursorCanvasComponent');
    private _width: number = -1;
    private _mouse: {
        x: number;
        kind: EChangeKind;
    } = {
        x: -1,
        kind: EChangeKind.undefined,
    };
    private _destroyed: boolean = false;

    @Input() getLeftOffset: () => number = () => 0;

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {
        this._onWindowMousemove = this._onWindowMousemove.bind(this);
        this._onWindowMouseup = this._onWindowMouseup.bind(this);
        window.addEventListener('mousemove', this._onWindowMousemove);
        window.addEventListener('mouseup', this._onWindowMouseup);
    }

    @HostListener('wheel', ['$event']) _ng_onWheel(event: WheelEvent) {
        if (this._ng_width === -1 || this._width === -1) {
            return;
        }
        let width: number = this._ng_width;
        let left: number = 0;
        // Detect direction
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            // Vertical scroll: zooming
            if (event.deltaY < 0) {
                // Zoom in
                if (width + event.deltaY < CSettings.minSize) {
                    width = CSettings.minSize;
                } else {
                    width += event.deltaY;
                }
            } else if (event.deltaY > 0) {
                // Zoom out
                if (width + event.deltaY > this._width) {
                    width = this._width;
                } else {
                    width += event.deltaY;
                }
            }
            left = this._ng_left - Math.round(event.deltaY / 2);
            if (left < 0) {
                left = 0;
            }
            if (left + width > this._width) {
                left = this._width - width;
            }
        } else {
            left = this._ng_left + event.deltaX;
            if (left < 0) {
                left = 0;
            }
            if (left + this._ng_width > this._width) {
                left = this._width - this._ng_width;
            }
        }
        this._ng_width = width;
        this._ng_left = left;
        this._emitChanges();
        this._forceUpdate();
        this._ng_preventDefault(event);
    }

    @HostListener('click', ['$event']) _ng_onClick(event: MouseEvent) {
        if (this._ng_width === -1 || this._width === -1) {
            return;
        }
        let x: number = event.offsetX;
        if ((event.target as HTMLElement).className === 'cursor') {
            x += this._ng_left;
        }
        let left: number = x - Math.round(this._ng_width / 2);
        if (left < 0) {
            left = 0;
        }
        if (left + this._ng_width > this._width) {
            left = this._width - this._ng_width;
        }
        this._ng_left = left;
        this._emitChanges();
        this._forceUpdate();
    }

    public ngAfterViewInit() {
        // Cursor events
        this._subscriptions.onSwitch = this.servicePosition
            .getObservable()
            .onSwitch.subscribe(this._onPositionRestored.bind(this));
        this._subscriptions.onForce = this.servicePosition
            .getObservable()
            .onForce.subscribe(this._onPositionForced.bind(this));
        // Data events
        this._subscriptions.onData = this.serviceData
            .getObservable()
            .onData.subscribe(this._onResizeIsRequired.bind(this));
        this._subscriptions.onCharts = this.serviceData
            .getObservable()
            .onCharts.subscribe(this._onResizeIsRequired.bind(this));
        // Listen session changes event
        this._subscriptions.onViewResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._onResizeIsRequired.bind(this),
        );
        // Listen offset changes
        this._subscriptions.onOffsetUpdated = this.onOffsetUpdated.subscribe(
            this._onResizeIsRequired.bind(this),
        );
        // Restore state
        this._restore();
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

    public _ng_preventDefault(event: MouseEvent) {
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
        return false;
    }

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
        const size: ClientRect = (
            this._vcRef.element.nativeElement as HTMLElement
        ).getBoundingClientRect();
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
        if (rate <= 1) {
            this._ng_width = width * rate;
        } else {
            this._ng_width = width;
        }
        this._ng_left = (this._ng_left - this.getLeftOffset()) / change + this.getLeftOffset();
        this._emitChanges();
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
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
    }

    private _emitChanges() {
        // Always round values, because it will go to service.data. Based on pixels will be calculated range of rows
        // only 1 px offset can make more than 100 rows offset in range. It will change scale.
        this._ng_width = Math.round(this._ng_width);
        this._ng_left = Math.round(this._ng_left);
        // const _left: number = this._ng_left - this.getLeftOffset();
        this.servicePosition.set({
            left: this._ng_left,
            width: this._ng_width,
            full: this._width,
        });
    }

    private _onResizeIsRequired() {
        this._resize();
    }

    private _onPositionRestored() {
        this._restore();
    }

    private _onPositionForced(change: IPositionForce) {
        if (this._ng_width === -1 || this._width === -1) {
            return;
        }
        let width: number = this._ng_width;
        let left: number = 0;
        // Zooming
        if (change.deltaY < 0) {
            // Zoom in
            if (width + change.deltaY < CSettings.minSize) {
                width = CSettings.minSize;
            } else {
                width += change.deltaY;
            }
        } else if (change.deltaY > 0) {
            // Zoom out
            if (width + change.deltaY > this._width) {
                width = this._width;
            } else {
                width += change.deltaY;
            }
        }
        // Position
        const cursorX: number = this._ng_width * change.proportionX + this._ng_left;
        left = Math.round(cursorX - width * change.proportionX);
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

    private _restore() {
        if (this._vcRef === undefined) {
            return;
        }
        const size: ClientRect = (
            this._vcRef.element.nativeElement as HTMLElement
        ).getBoundingClientRect();
        this.servicePosition.correction(size.width);
        const position: IPositionChange | undefined = this.servicePosition.get();
        if (position === undefined) {
            return;
        }
        this._ng_left = position.left;
        this._ng_width = position.width;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
