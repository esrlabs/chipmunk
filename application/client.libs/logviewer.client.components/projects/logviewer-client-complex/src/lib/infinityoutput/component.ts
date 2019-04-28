// tslint:disable:max-line-length
import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription, Subject } from 'rxjs';

export interface IRange {
    start: number;
    end: number;
}

export interface IRow {
    [key: string]: any;
}

export interface IStorageInformation {
    count: number;
}

export interface IRowsPacket {
    range: IRange;
    rows: IRow[];
}

export interface IBoxSize {
    width: number;
    height: number;
}

export interface IDataAPI {
    getRange: (range: IRange) => IRowsPacket;
    getStorageInfo: () => IStorageInformation;
    getComponentFactory: () => any;
    getItemHeight: () => number;
    updatingDone: (range: IRange) => void;
    onStorageUpdated: Subject<IStorageInformation>;
    onScrollTo: Subject<number>;
    onRowsDelivered: Subject<IRowsPacket>;
    onRedraw: Subject<void>;
}

export interface ISettings {
    minScrollTopScale: number;      // To "catch" scroll event in reverse direction (to up) we should always keep minimal scroll offset
    minScrollTopNotScale: number;   // To "catch" scroll event in reverse direction (to up) we should always keep minimal scroll offset
    maxScrollHeight: number;        // Maximum scroll area height in px.
    scrollToOffset: number;         // How many items show before item defined on scrollTo
    scrollBarSize: number;          // Size of scroll bar: height for horizontal; width for vertical. In px.
}

enum EKeys {
    ArrowUp = 'ArrowUp',
    ArrowDown = 'ArrowDown',
    PageUp = 'PageUp',
    PageDown = 'PageDown',
    Home = 'Home',
    End = 'End',
    undefined = 'undefined'
}

const DefaultSettings = {
    minScrollTopScale       : 100,          // To "catch" scroll event in reverse direction (to up) we should always keep minimal scroll offset
    minScrollTopNotScale    : 0,            // To "catch" scroll event in reverse direction (to up) we should always keep minimal scroll offset
    maxScrollHeight         : 100000,       // Maximum scroll area height in px.
    scrollToOffset          : 5,            // How many items show before item defined on scrollTo
    scrollBarSize           : 8,            // Size of scroll bar: height for horizontal; width for vertical. In px.
};

const winplatforms = ['os/2', 'pocket pc', 'windows', 'win16', 'win32', 'wince'];

@Component({
    selector: 'lib-complex-infinity-output',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ComplexInfinityOutputComponent implements OnDestroy, AfterContentInit {

    @ViewChild('container') _ng_nodeContainer: ElementRef;
    @ViewChild('holder') _ng_nodeHolder: ElementRef;
    @ViewChild('filler') _ng_nodeFiller: ElementRef;

    @Input() public API: IDataAPI | undefined;
    @Input() public settings: ISettings | undefined;

    public _ng_rows: Array<IRow | number> = [];
    public _ng_factory: any;

    private _settings: ISettings = DefaultSettings;
    private _storageInfo: IStorageInformation | undefined;
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _containerSize: IBoxSize | undefined;
    private _vSB: {
        scale: number,
        minScrollTop: number,
        maxScrollTop: number,
        heightFiller: number,
        itemHeight: number,
        cache: number,
        lastWheel: number,
        scrollTo: number,
    } = {
        scale: 1,
        minScrollTop: 0,
        maxScrollTop: 0,
        heightFiller: -1,
        itemHeight: 0,
        cache: -1,
        lastWheel: 0,
        scrollTo: -1,
    };
    private _state: {
        start: number;
        end: number;
        count: number;
    } = {
        start: 0,
        end: 0,
        count: 0,
    };
    private _scrollTimer: any;
    private _windows: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
        this._detectWindows();
    }

    public ngAfterContentInit() {
        if (this.API === undefined) {
            return;
        }
        if (this.settings !== undefined) {
            this._settings = Object.assign(DefaultSettings, this._settings);
        }
        this._ng_factory = this.API.getComponentFactory();
        // Get information about storage
        this._storageInfo = this.API.getStorageInfo();
        // Store item height
        this._vSB.itemHeight = this.API.getItemHeight();
        // Update data about sizes
        this._updateContainerSize();
        // Update state of vertical scroll bar
        this._updateVSB();
        // Subscribe
        this._subscriptions.onRowsDelivered = this.API.onRowsDelivered.asObservable().subscribe(this._onRowsDelivered.bind(this));
        this._subscriptions.onScrollTo = this.API.onScrollTo.asObservable().subscribe(this._onScrollTo.bind(this));
        this._subscriptions.onStorageUpdated = this.API.onStorageUpdated.asObservable().subscribe(this._onStorageUpdated.bind(this));
        this._subscriptions.onRedraw = this.API.onRedraw.asObservable().subscribe(this._onRedraw.bind(this));
        // Get rows
        const rows = this.API.getRange({
            start: 0,
            end: this._state.count > this._storageInfo.count ? (this._storageInfo.count - 1) : this._state.count
        }).rows;
        this._ng_rows = rows;
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._ng_rows = [];
    }

    public _ng_isRowPending(row: IRow): boolean {
        return typeof row === 'number';
    }

    public _ng_onBrowserWindowResize(event?: Event) {
        // Update data about sizes
        this._updateContainerSize(true);
        // Update state of vertical scroll bar
        this._updateVSB();
        // Check currect state
        if (this._state.start + this._state.count > this._state.end) {
            this._state.end = this._state.start + this._state.count;
            if (this._state.end > this._storageInfo.count - 1) {
                this._state.end = this._storageInfo.count - 1;
                this._state.start = (this._state.end - this._state.count) > 0 ? (this._state.end - this._state.count) : 0;
            }
            this._render();
            // Notification: update is done
            this.API.updatingDone({ start: this._state.start, end: this._state.end });
        }
    }

    public _ng_onScroll(event: MouseEvent) {
        this._cdRef.detectChanges();
        if (!this._onScroll(event.target as HTMLElement)) {
            event.preventDefault();
            return false;
        }
        this._cdRef.detectChanges();
    }

    public _ng_onWheel(event: MouseEvent | TouchEvent) {
        this._vSB.lastWheel = Date.now();
    }

    public _ng_onKeyDown(event: KeyboardEvent) {
        if ([EKeys.ArrowDown, EKeys.ArrowUp, EKeys.End, EKeys.Home, EKeys.PageDown, EKeys.PageUp].indexOf(event.key as EKeys) === -1) {
            return true;
        }
        event.preventDefault();
        this._onKeyboardAction(event.key as EKeys);
        return false;
    }

    public _ng_getFillerStyles(): { [key: string]: any } {
        return {
            height: `${this._vSB.heightFiller}px`,
            width: `1px`
        };
    }

    public _ng_getItemStyles(): { [key: string]: any } {
        return {
            height: `${this._vSB.itemHeight}px`,
        };
    }

    private _onScroll(container: HTMLElement): boolean {
        // Check state (could be reset state)
        if (this._vSB.heightFiller <= 0) {
            return;
        }
        // Get current scroll position
        const scrollTop: number = container.scrollTop;
        if (scrollTop === this._vSB.cache) {
            return false;
        }
        clearTimeout(this._scrollTimer);
        let update: { scrollTop: number, redraw: boolean, rescroll: boolean };
        if (this._vSB.heightFiller < this._settings.maxScrollHeight) {
            update = this._scrollWithoutScale(scrollTop);
        } else {
            update = this._scrollWithScale(scrollTop);
        }
        // Drop scrollTo
        this._vSB.scrollTo = -1;
        if (update.rescroll) {
            // Drop cache
            this._vSB.cache = update.scrollTop;
            // Set scroll value
            if (this._windows) {
                this._scrollTimer = setTimeout(() => {
                    container.scrollTop = update.scrollTop;
                }, 0);
            } else {
                container.scrollTop = update.scrollTop;
            }
        } else {
            // Drop cache
            this._vSB.cache = scrollTop;
        }
        // Redraw
        if (update.redraw) {
            // Update list
            this._render();
            // Notification: scroll is done
            this.API.updatingDone({ start: this._state.start, end: this._state.end });
        }
        return true;
    }

    private _correctScrollTop(scrollTop: number): number {
        // Check minimal offset from top
        if (scrollTop < this._vSB.minScrollTop) {
            scrollTop = this._vSB.minScrollTop;
        }
        // Check minimal offset from bottom
        if (scrollTop > this._vSB.maxScrollTop) {
            scrollTop = this._vSB.maxScrollTop;
        }
        return scrollTop;
    }

    private _setStateEnd() {
        this._state.end = this._state.start + this._state.count;
        if (this._state.end > this._storageInfo.count - 1) {
            this._state.end = this._storageInfo.count - 1;
            this._state.start = (this._storageInfo.count - this._state.count) > 0 ? (this._storageInfo.count - this._state.count) : 0;
        }
    }

    private _scrollWithScale(scrollTop: number): { scrollTop: number, redraw: boolean, rescroll: boolean } {
        if (this._vSB.scrollTo !== -1) {
            this._state.start = this._vSB.scrollTo;
            this._setStateEnd();
            return { scrollTop: this._correctScrollTop(scrollTop), redraw: true, rescroll: false };
        }
        let change: number = this._vSB.cache === -1 ? scrollTop : (scrollTop - this._vSB.cache);
        const direction: number = change > 0 ? 1 : -1;
        if (direction < 0 && this._state.start === 0) {
            // Already beginning of list
            return { scrollTop: this._vSB.minScrollTop, redraw: false, rescroll: false };
        }
        if (direction > 0 && this._state.end === this._storageInfo.count - 1) {
            // Already end of list
            return { scrollTop: this._vSB.maxScrollTop, redraw: false, rescroll: false };
        }
        if (!this._isScrolledByWheel()) {
            // Calculate considering scale
            let start = Math.round((scrollTop / this._vSB.maxScrollTop) * (this._storageInfo.count - 1));
            if (direction > 0 && this._state.start > start) {
                start = this._state.start;
            }
            if (direction < 0 && this._state.start < start) {
                start = this._state.start;
            }
            this._state.start = start;
        } else {
            change = Math.abs(change);
            // Check minimal scrollTop
            if (change < this._vSB.itemHeight) {
                change = this._vSB.itemHeight;
            }
            // Calculate without scale
            this._state.start += Math.round(change / this._vSB.itemHeight) * direction;
        }
        if (this._state.start < 0) {
            this._state.start = 0;
        } else if (this._state.start > this._storageInfo.count - this._state.count) {
            this._state.start = (this._storageInfo.count - this._state.count) > 0 ? (this._storageInfo.count - this._state.count) : 0;
        }
        if (!this._isScrolledByWheel()) {
            // Do not change scroll top in this case
        } else {
            // Recalculate scroll top
            scrollTop = Math.round((this._state.start * this._vSB.itemHeight) * this._vSB.scale);
        }
        this._setStateEnd();
        if (!this._isScrolledByWheel()) {
            return { scrollTop: this._correctScrollTop(scrollTop), redraw: true, rescroll: false };
        } else {
            return { scrollTop: this._correctScrollTop(scrollTop), redraw: true, rescroll: true };
        }
    }

    private _scrollWithoutScale(scrollTop: number): { scrollTop: number, redraw: boolean, rescroll: boolean } {
        if (this._vSB.scrollTo !== -1) {
            this._state.start = this._vSB.scrollTo;
            this._setStateEnd();
            return { scrollTop: this._correctScrollTop(scrollTop), redraw: true, rescroll: false };
        }
        const change: number = this._vSB.cache === -1 ? scrollTop : (scrollTop - this._vSB.cache);
        const direction: number = change > 0 ? 1 : -1;
        let start = Math.round((scrollTop / this._vSB.heightFiller) * this._storageInfo.count);
        if (direction > 0 && this._state.start > start) {
            start = this._state.start;
        }
        if (direction < 0 && this._state.start < start) {
            start = this._state.start;
        }
        this._state.start = start;
        this._setStateEnd();
        return { scrollTop: this._correctScrollTop(scrollTop), redraw: true, rescroll: false };
    }

    private _isScrolledByWheel(): boolean {
        return Date.now() - this._vSB.lastWheel < 500;
    }

    private _onKeyboardAction(key: EKeys) {
        switch (key) {
            case EKeys.ArrowDown:
                if (this._state.start + 1 > this._storageInfo.count - 1) {
                    return;
                }
                this._onScrollTo(this._state.start + 1, true);
                break;
            case EKeys.ArrowUp:
                if (this._state.start - 1 < 0) {
                    return;
                }
                this._onScrollTo(this._state.start - 1, true);
                break;
            case EKeys.PageDown:
                if (this._state.start + this._state.count > this._storageInfo.count - 1) {
                    this._onScrollTo(this._storageInfo.count - 1, true);
                    return;
                }
                this._onScrollTo(this._state.start + this._state.count, true);
                break;
            case EKeys.PageUp:
                if (this._state.start - this._state.count < 0) {
                    this._onScrollTo(0, true);
                    return;
                }
                this._onScrollTo(this._state.start - this._state.count, true);
                break;
            case EKeys.End:
                if (this._state.start === this._storageInfo.count - 1) {
                    return;
                }
                this._onScrollTo(this._storageInfo.count - 1, true);
                break;
            case EKeys.Home:
                if (this._state.start === 0) {
                    return;
                }
                this._onScrollTo(0, true);
                break;
        }
    }

    private _updateContainerSize(force: boolean = false) {
        if (this._ng_nodeContainer === undefined) {
            return;
        }
        if (!force && this._containerSize !== undefined) {
            return;
        }
        this._containerSize = (this._ng_nodeContainer.nativeElement as HTMLElement).getBoundingClientRect();
        this._containerSize.height -= this._settings.scrollBarSize;
        this._state.count = Math.floor(this._containerSize.height / this._vSB.itemHeight);
    }

    private _updateVSB() {
        if (!this._isAllAvailable()) {
            return;
        }
        // Calculate scroll area height
        const scrollHeight: number = this._storageInfo.count * this._vSB.itemHeight;
        // Check: do we need scroll bar at all for a moment
        if (this._containerSize.height >= scrollHeight) {
            this._vSB.heightFiller = 0;
            return;
        }
        // Calculate scale
        if (scrollHeight < this._settings.maxScrollHeight) {
            this._vSB.scale = 1;
            this._vSB.minScrollTop = this._settings.minScrollTopNotScale;
            this._vSB.maxScrollTop = scrollHeight - this._containerSize.height - this._vSB.minScrollTop * 2;
            this._vSB.heightFiller = scrollHeight;
        } else {
            this._vSB.scale = this._settings.maxScrollHeight / scrollHeight;
            this._vSB.heightFiller = this._settings.maxScrollHeight;
            this._vSB.minScrollTop = this._settings.minScrollTopScale;
            this._vSB.maxScrollTop = this._vSB.heightFiller - this._containerSize.height - this._vSB.minScrollTop * 2;
            }
        // Update
        this._cdRef.detectChanges();
    }

    private _isAllAvailable(): boolean {
        if (this._containerSize === undefined) {
            return false;
        }
        if (this._storageInfo === undefined) {
            return false;
        }
        if (this.API === undefined) {
            return false;
        }
        return true;
    }

    private _onRowsDelivered(packet: IRowsPacket) {
        // Check: is packet still actual
        if (packet.range.start !== this._state.start || packet.range.end !== this._state.end) {
            this._render();
            return;
        }
        // Replace rows
        this._ng_rows = packet.rows;
        // Force update
        this._cdRef.detectChanges();
    }

    private _onScrollTo(row: number, noOffset: boolean = false) {
        // Correct row value
        row = row > this._storageInfo.count - 1 ? (this._storageInfo.count - 1) : row;
        row = row < 0 ? 0 : row;
        this._vSB.cache = -1;
        // Detect start of frame
        const start: number = noOffset ? row : (row - this._settings.scrollToOffset > 0 ? (row - this._settings.scrollToOffset) : 0);
        // Drop frame to begin
        this._vSB.scrollTo = start;
        // Calculate scale
        let scrollTop = Math.round((start * this._vSB.itemHeight) * this._vSB.scale);
        if (scrollTop + this._containerSize.height > this._vSB.heightFiller) {
            scrollTop = this._vSB.maxScrollTop;
        }
        if (this._ng_nodeContainer.nativeElement.scrollTop === scrollTop) {
            // Event of scroll will not be triggered, call manually
            this._onScroll(this._ng_nodeContainer.nativeElement);
        } else {
            this._ng_nodeContainer.nativeElement.scrollTop = scrollTop;
        }
    }

    private _reset() {
        this._vSB.cache = -1;
        this._vSB.scrollTo = -1;
        this._vSB.heightFiller = -1;
        this._state.start = 0;
        this._state.end = 0;
        this._ng_rows = [];
    }

    private _onStorageUpdated(info: IStorageInformation) {
        if (info.count < 0 || isNaN(info.count) || !isFinite(info.count)) {
            return console.error(new Error(`Fail to proceed event "onStorageUpdated" with count = ${info.count}. Please check trigger of this event.`));
        }
        let shouldBeUpdated: boolean;
        if (info.count === 0) {
            this._reset();
            shouldBeUpdated = true;
        } else if (this._state.start + this._state.count > info.count - 1) {
            this._state.end = info.count - 1;
            shouldBeUpdated = true;
        } else if (this._storageInfo.count < this._state.count && info.count > this._state.count) {
            this._state.end = this._state.start + this._state.count;
            shouldBeUpdated = true;
        }
        // Update storage data
        this._storageInfo.count = info.count;
        // Scroll bar
        this._updateVSB();
        if (shouldBeUpdated) {
            // Render
            this._render();
            if (info.count === 0) {
                // No need to do other actions, because no data
                return;
            }
            // Notification: scroll is done
            this.API.updatingDone({ start: this._state.start, end: this._state.end });
        }
    }

    private _isStateValid(): boolean {
        if (this._state.start < 0 || this._state.end < 0) {
            return false;
        }
        if (this._state.start > this._state.end) {
            return false;
        }
        if (isNaN(this._state.start) || isNaN(this._state.end)) {
            return false;
        }
        if (!isFinite(this._state.start) || !isFinite(this._state.end)) {
            return false;
        }
        return true;
    }

    private _render() {
        if (!this._isStateValid() || (this._state.end - this._state.start) === 0) {
            // This case can be in case of asynch calls usage
            this._ng_rows = [];
            return this._cdRef.detectChanges();
        }
        const frame = this.API.getRange({ start: this._state.start, end: this._state.end});
        const rows: Array<IRow | number> = frame.rows;
        const pending = (this._state.count < this._storageInfo.count) ? (this._state.count - rows.length) : (this._storageInfo.count - rows.length);
        if (pending > 0) {
            // Not all rows were gotten
            if (frame.range.start === this._state.start) {
                // Not load from the end
                rows.push(...Array.from({ length: pending }).map((_, i) => {
                    return i + this._state.start;
                }));
            } else {
                // Not load from beggining
                rows.unshift(...Array.from({ length: pending }).map((_, i) => {
                    return i + this._state.start;
                }));
            }
        }
        this._ng_rows = rows;
        this._cdRef.detectChanges();
    }

    private _onRedraw() {
        this._ng_onBrowserWindowResize();
    }

    private _detectWindows() {
        const platform = navigator.platform.toLowerCase();
        winplatforms.forEach((alias: string) => {
            if (platform.indexOf(alias) !== -1) {
                this._windows = true;
            }
        });
    }

}

