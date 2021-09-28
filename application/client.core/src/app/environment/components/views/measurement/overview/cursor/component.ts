import {
    Component,
    HostListener,
    AfterViewInit,
    OnDestroy,
    ChangeDetectorRef,
    ViewContainerRef,
    AfterContentInit,
    Input,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DataService } from '../../service.data';

import ViewsEventsService from '../../../../../services/standalone/service.views.events';
import EventsSessionService from '../../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EChangeKind {
    move = 'move',
    left = 'left',
    right = 'right',
    zoom = 'zoom',
    set = 'set',
    undefined = 'undefined',
}

@Component({
    selector: 'app-views-measurement-overview-cursor',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ViewMeasurementOverviewCursorComponent
    implements AfterContentInit, AfterViewInit, OnDestroy
{
    @Input() service!: DataService;

    public _ng_width: number = -1;
    public _ng_left: number = 0;
    public _ng_selection_left: number | undefined;
    public _ng_selection_width: number | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementOverviewCursorComponent');
    private _width: number = -1;
    private _mouse: {
        x: number | undefined;
        kind: EChangeKind;
    } = {
        x: undefined,
        kind: EChangeKind.undefined,
    };
    private _destroyed: boolean = false;

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
        const r = this.service.getDuration() / this._width;
        let width: number = this._ng_width;
        let left: number = 0;
        // Detect direction
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            // Vertical scroll: zooming
            if (event.deltaY < 0) {
                // Zoom in
                if (width + event.deltaY < this.service.MIN_ZOOMING_PX) {
                    width = this.service.MIN_ZOOMING_PX;
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
        this.service.setZoomOffsets(
            this._ng_left * r,
            (this._width - (this._ng_left + this._ng_width)) * r,
        );
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    @HostListener('mousedown', ['$event']) _ng_onClick(event: MouseEvent) {
        if (
            (event.target as HTMLElement).nodeName.toLowerCase() !==
                'app-views-measurement-overview-cursor' &&
            (event.target as HTMLElement).className.indexOf('select') === -1
        ) {
            return;
        }
        this._mouse.x = event.x;
        this._ng_selection_left = event.clientX;
        this._ng_selection_width = 1;
        this._forceUpdate();
    }

    public ngAfterContentInit() {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.zoom = this.service
            .getObservable()
            .zoom.subscribe(this._onChartDataZoom.bind(this));
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._resize.bind(this),
        );
    }

    public ngAfterViewInit() {
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

    public _ng_getSelectionStyle(): { [key: string]: string } {
        if (this._ng_selection_width === undefined || this._ng_selection_left === undefined) {
            return {};
        }
        return {
            left: `${
                this._ng_selection_width < 0
                    ? this._ng_selection_left + this._ng_selection_width
                    : this._ng_selection_left
            }px`,
            width: `${Math.abs(this._ng_selection_width)}px`,
        };
    }

    private _onSessionChange() {
        this._update();
    }

    private _onChartDataZoom() {
        this._update();
    }

    private _resize() {
        const rect = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        this._width = rect.width;
        this._update();
    }

    private _update() {
        if (this.service === undefined) {
            return;
        }
        const state = this.service.getCursorState();
        if (state === undefined) {
            return;
        }
        if (state.left === 0 && state.right === 0) {
            this._ng_left = 0;
            this._ng_width = this._width;
        } else {
            const duration = this.service.getDuration();
            const r = duration / this._width;
            if (isNaN(r) || !isFinite(r)) {
                return this._forceUpdate();
            }
            this._ng_left = state.left / r;
            this._ng_width = Math.abs(duration - state.left - state.right) / r;
        }
        this._forceUpdate();
    }

    private _onWindowMousemove(event: MouseEvent) {
        if (this._mouse.x === undefined) {
            return;
        }
        const state = this.service.getCursorState();
        if (state === undefined) {
            return;
        }
        if (event.x < 0) {
            this._mouse.x = 0;
            return;
        }
        const offset: number = event.x - this._mouse.x;
        this._mouse.x = event.x;
        if (this._ng_selection_left === undefined) {
            this._change(this._mouse.kind, offset);
        } else if (this._ng_selection_width !== undefined) {
            this._ng_selection_width += offset;
            if (this._ng_selection_width + this._ng_selection_left < 0) {
                this._ng_selection_width = -this._ng_selection_left;
            }
            if (this._ng_selection_width + this._ng_selection_left > this._width) {
                this._ng_selection_width = this._width - this._ng_selection_left;
            }
            this._forceUpdate();
        }
    }

    private _onWindowMouseup(event: MouseEvent) {
        if (this._mouse.x === undefined) {
            return;
        }
        this._mouse.x = undefined;
        this._mouse.kind = EChangeKind.undefined;
        if (this._ng_selection_left !== undefined && this._ng_selection_width !== undefined) {
            this._ng_left =
                this._ng_selection_width < 0
                    ? this._ng_selection_left + this._ng_selection_width
                    : this._ng_selection_left;
            this._change(EChangeKind.set, Math.abs(this._ng_selection_width));
            this._ng_selection_left = undefined;
            this._ng_selection_width = undefined;
            this._forceUpdate();
        }
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
    }

    private _change(kind: EChangeKind, offset: number) {
        const r = this.service.getDuration() / this._width;
        switch (kind) {
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
                } else if (this._ng_width - offset < this.service.MIN_ZOOMING_PX) {
                    //
                } else {
                    this._ng_left += offset;
                    this._ng_width -= offset;
                }
                break;
            case EChangeKind.right:
                if (this._ng_width + offset < this.service.MIN_ZOOMING_PX) {
                    this._ng_width = this.service.MIN_ZOOMING_PX;
                } else if (this._ng_left + this._ng_width + offset > this._width) {
                    this._ng_width = this._width - this._ng_left;
                } else {
                    this._ng_width += offset;
                }
                break;
            case EChangeKind.set:
                if (offset < this.service.MIN_ZOOMING_PX) {
                    offset = this.service.MIN_ZOOMING_PX;
                }
                this._ng_width = offset;
                if (this._ng_left + this._ng_width > this._width) {
                    this._ng_left = this._width - this._ng_width;
                }
                break;
        }
        this.service.setZoomOffsets(
            this._ng_left * r,
            (this._width - (this._ng_left + this._ng_width)) * r,
        );
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
