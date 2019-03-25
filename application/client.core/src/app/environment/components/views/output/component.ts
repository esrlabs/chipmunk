import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { ControllerSessionTab, IComponentInjection } from '../../../controller/controller.session.tab';
import { ControllerSessionTabStreamOutput, IStreamPacket } from '../../../controller/controller.session.tab.stream.output';

enum EScrollBarType {
    horizontal = 'horizontal',
    vertical = 'vertical'
}

interface IRange {
    start: number;
    end: number;
}


@Component({
    selector: 'app-views-output',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewOutputComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @ViewChild('outputviewport') _ng_outputAreaViewport: CdkVirtualScrollViewport;
    @ViewChild('outputwrapper') _ng_outputWrapperViewport: ElementRef;

    @Input() public session: ControllerSessionTab | undefined;

    public _ng_output: ControllerSessionTabStreamOutput | undefined;
    public _ng_itemHeight: number = 16;
    public _ng_injections: {
        bottom: Map<string, IComponentInjection>,
    } = {
        bottom: new Map()
    };

    public _ng_outputAreaSize: {
        height: number;
        width: number;
    } = {
        width: 0,
        height: 0,
    };

    public _ng_scrollbarVisibility: {
        vertical: boolean,
        horizontal: boolean,
    } = {
        vertical: false,
        horizontal: false,
    };
    public _ng_scrollTop: number;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _streamInfo: {
        rowsInStream: number,
        rowsInViewPort: number,
        firstInStream: number,
        firstInView: number,
    } = {
        rowsInStream: 0,
        rowsInViewPort: 0,
        firstInStream: 0,
        firstInView: 0
    };
    private _mouseData: {
        x: number,
        y: number,
        offset: number,
        scrollTop: number,
        type: EScrollBarType
    } = {
        x: -1,
        y: -1,
        offset: -1,
        scrollTop: -1,
        type: EScrollBarType.horizontal
    };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
        this._win_onMouseMove = this._win_onMouseMove.bind(this);
        this._win_onMouseUp = this._win_onMouseUp.bind(this);
        window.addEventListener('mousemove', this._win_onMouseMove);
        window.addEventListener('mouseup', this._win_onMouseUp);
    }

    ngAfterViewInit() {
        this._updateOutputContainerSize();
    }

    ngAfterContentInit() {
        if (this.session === undefined) {
            return;
        }
        // Get reference to stream wrapper
        this._ng_output = this.session.getSessionStream().getOutputStream();
        // Get injections
        this._ng_injections.bottom = this.session.getOutputBottomInjections();
        // Make subscriptions
        this._subscriptions.updated = this._ng_output.getObservable().updated.subscribe(this._onUpdated.bind(this));
        this._subscriptions.scrollTo = this._ng_output.getObservable().scrollTo.subscribe(this._onScrollTo.bind(this));
        // Update stream parameters
        this._updateScrollBarsState();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        window.removeEventListener('mousemove', this._win_onMouseMove);
        window.removeEventListener('mouseup', this._win_onMouseUp);
    }

    public _ng_getOutputAreaStyle(): { [key: string]: string | number } {
        return {
            'width': `${this._ng_outputAreaSize.width}px`,
            'height': `${this._ng_outputAreaSize.height}px`,
        };
    }

    public _ng_onBrowserWindowResize() {
        this._updateOutputContainerSize();
    }

    public _ng_trackByIdx(index: number, item: IStreamPacket) {
        return index;
    }

    public _ng_scrolledIndexChange(index: number) {
        const range: IRange = this._getRangeRowsInView();
        this._ng_output.setViewport(range.start, range.end);
        this._updateScrollBarsState();
    }

    public _ng_onScrollMouseDown(event: MouseEvent, type: EScrollBarType) {
        this._mouseData.x = event.x;
        this._mouseData.y = event.y;
        this._mouseData.offset = 0;
        this._mouseData.type = type;
        this._mouseData.scrollTop = this._ng_outputAreaViewport.measureScrollOffset('top');
    }

    public _ng_getScrollCursorStyle(type: EScrollBarType): { [key: string]: string | number } {
        switch (type) {
            case EScrollBarType.horizontal:
                return {};
            case EScrollBarType.vertical:
                const height: number = (this._streamInfo.rowsInViewPort / this._streamInfo.rowsInStream) * 100;
                const top: number = (this._streamInfo.firstInStream / this._streamInfo.rowsInStream) * 100;
                console.log(`TOP: ${top + height > 100 ? (100 - height) : top}%`);
                return {
                    height: `${height < 5 ? 5 : height}%`,
                    top: `${top + height > 100 ? (100 - height) : top}%`,
                };
        }
    }

    private _getRangeRowsInView(): IRange {
        if (this._ng_outputAreaViewport === undefined) {
            throw new Error(`Unexpected request range of rendered rows`);
        }
        const range = this._ng_outputAreaViewport.getRenderedRange();
        const count = this._ng_output.getRowsCount();
        return {
            start: range.start >= 0 ? range.start : 0,
            end: range.end < count - 1 ? range.end : count - 1
        };
    }

    private _updateOutputContainerSize() {
        if (this._ng_outputAreaViewport === null || this._ng_outputAreaViewport === undefined) {
            return;
        }
        const size = this._ng_outputWrapperViewport.nativeElement.getBoundingClientRect();
        this._ng_outputAreaSize.width = size.width;
        this._ng_outputAreaSize.height = size.height;
        this._cdRef.detectChanges();
        this._ng_outputAreaViewport.checkViewportSize();
    }

    private _autoScroll() {
        if (this._ng_outputAreaViewport === null || this._ng_outputAreaViewport === undefined) {
            return;
        }
        this._ng_outputAreaViewport.scrollTo({bottom: 0});
    }

    private _onUpdated(countRowsInStream: number) {
        const range: IRange | undefined = this._getRangeRowsInView();
        this._updateOutputContainerSize();
        this._ng_output.setViewport(range.start, range.end);
        this._updateScrollBarsState(countRowsInStream);
        this._autoScroll();
    }

    private _updateScrollBarsState(countRowsInStream?: number) {
        if (this._ng_output === undefined || this._ng_outputAreaViewport === undefined) {
            return;
        }
        const scrollTop: number = this._ng_outputAreaViewport.measureScrollOffset('top');
        const firstRowInView: number = Math.floor(scrollTop / this._ng_itemHeight);
        const firstRowData = this._ng_output.getRow(Math.round(scrollTop / this._ng_itemHeight));
        if (firstRowData === undefined) {
            return;
        }
        // 16 => consider height of horizontal scroll bar
        this._streamInfo.rowsInViewPort = (this._ng_outputAreaSize.height - 16) / this._ng_itemHeight;
        this._streamInfo.rowsInStream = countRowsInStream ? countRowsInStream : this._ng_output.getRowsCount();
        this._streamInfo.firstInStream = firstRowData.position;
        this._streamInfo.firstInView = firstRowInView;
        this._ng_scrollbarVisibility.vertical = this._streamInfo.rowsInStream > this._streamInfo.rowsInViewPort;
        this._cdRef.detectChanges();
    }

    private _onScrollTo(index: number) {
        this._ng_outputAreaViewport.scrollToIndex(index);
    }

    private _win_onMouseMove(event: MouseEvent) {
        if (this._mouseData.x === -1 || this._mouseData.y === -1) {
            return;
        }
        switch (this._mouseData.type) {
            case EScrollBarType.horizontal:
                break;
            case EScrollBarType.vertical:
                const rate = this._streamInfo.rowsInStream / this._streamInfo.rowsInViewPort;
                this._mouseData.offset += (event.y - this._mouseData.y) * rate;
                const firstRowInView: number = Math.round((this._mouseData.scrollTop + this._mouseData.offset) / this._ng_itemHeight);
                if (firstRowInView !== this._streamInfo.firstInView) {
                    this._ng_outputAreaViewport.scrollToIndex(firstRowInView);
                }
                console.log(`${this._mouseData.scrollTop} / ${this._mouseData.offset} / ${firstRowInView}`);
                break;
        }
        this._mouseData.x = event.x;
        this._mouseData.y = event.y;
    }

    private _win_onMouseUp(event: MouseEvent) {
        if (this._mouseData.x === -1 || this._mouseData.y === -1) {
            return;
        }
        this._mouseData.x = -1;
        this._mouseData.y = -1;
        this._mouseData.offset = 0;
    }


}
