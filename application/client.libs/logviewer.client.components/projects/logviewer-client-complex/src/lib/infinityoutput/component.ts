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

export interface IDataAPI {
    getRange: (range: IRange) => IRowsPacket;
    getStorageInfo: () => IStorageInformation;
    getComponentFactory: () => any;
    getItemHeight: () => number;
    updatingDone: (range: IRange) => void;
    onStorageUpdated: Subject<IStorageInformation>;
    onScrollTo: Subject<number>;
    onRowsDelivered: Subject<IRowsPacket>;
}

const Settings = {
    minScrollTop   : 1,         // To "catch" scroll event in reverse direction (to up) we should always keep minimal scroll offset
    maxScrollHeight: 100000,    // Maximum scroll area height in px.
    maxSlowDistance: 20,        // Less this distance will be applied scrolling without scale. In heights of items
    scrollToOffset: 5,          // How many items show before item defined on scrollTo
};

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

    public _ng_rows: Array<IRow | number> = [];
    public _ng_factory: any;

    private _storageInfo: IStorageInformation | undefined;
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _containerSize: ClientRect | undefined;
    private _vSB: {
        scale: number,
        heightFiller: number,
        offset: number,
        maxSlowDistancePx: number,
        itemHeight: number,
        cache: number,
        prevScrollTop: number,
    } = {
        scale: 1,
        heightFiller: -1,
        offset: 0,
        maxSlowDistancePx: 0,
        itemHeight: 0,
        cache: -1,
        prevScrollTop: -1,
    };
    private _state: {
        start: number;
        end: number;
        count: number;
    } = {
        start: 0,
        end: 0,
        count: 0
    };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    public ngAfterContentInit() {
        if (this.API === undefined) {
            return;
        }
        this._ng_factory = this.API.getComponentFactory();
        // Get information about storage
        this._storageInfo = this.API.getStorageInfo();
        // Convert maxSlowDistance to px
        this._vSB.maxSlowDistancePx = Settings.maxSlowDistance * this.API.getItemHeight();
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

    public _ng_onBrowserWindowResize(event: Event) {
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
        // Get current scroll position
        const scrollTop: number = (event.target as HTMLElement).scrollTop;
        // Check max size of scroll top
        if (scrollTop >= Settings.maxScrollHeight) {
            return;
        }
        if (scrollTop === this._vSB.cache) {
            return;
        }
        if (scrollTop === this._vSB.prevScrollTop) {
            if (this._state.start !== 0 && scrollTop === this._vSB.offset) {
                return;
            } else if (scrollTop !== 0 && scrollTop !== this._vSB.offset && this._state.end !== (this._storageInfo.count - 1)) {
                this._vSB.offset = scrollTop;
                this._vSB.cache = scrollTop;
                return;
            }
        }
        this._vSB.prevScrollTop = scrollTop;
        let shouldBeUpdated: boolean;
        if (this._vSB.heightFiller < Settings.maxScrollHeight) {
            shouldBeUpdated = this._scrollWithoutScale(event.target as HTMLElement, scrollTop);
        } else {
            shouldBeUpdated = this._scrollWithScale(event.target as HTMLElement, scrollTop);
        }
        if (shouldBeUpdated) {
            // Update list
            this._render();
            // Notification: scroll is done
            this.API.updatingDone({ start: this._state.start, end: this._state.end });
        }
        this._cdRef.detectChanges();
    }

    public _ng_getFillerStyles(): { [key: string]: any } {
        return {
            height: `${this._vSB.heightFiller}px`,
            width: `1px`
        };
    }

    public _ng_getHolderStyles(): { [key: string]: any } {
        return {
            marginTop: `${this._vSB.offset}px`
        };
    }

    public _ng_getItemStyles(): { [key: string]: any } {
        return {
            height: `${this._vSB.itemHeight}px`,
        };
    }

    private _scrollWithScale(target: HTMLElement, scrollTop: number): boolean {
        const minScrollTop = this._vSB.maxSlowDistancePx;
        const maxScrollTop = this._vSB.heightFiller - this._containerSize.height - this._vSB.maxSlowDistancePx;
        let change: number = this._vSB.cache === -1 ? scrollTop : (scrollTop - this._vSB.cache);
        const direction: number = change > 0 ? 1 : -1;
        if (direction < 0 && this._state.start === 0) {
            // Already beginning of list
            scrollTop = minScrollTop;
            target.scrollTop = scrollTop;
            this._vSB.cache = scrollTop;
            return false;
        }
        if (direction > 0 && this._state.end === this._storageInfo.count - 1) {
            // Already end of list
            scrollTop = maxScrollTop;
            target.scrollTop = scrollTop;
            this._vSB.cache = scrollTop;
            return false;
        }
        if (this._state.start === -1) {
            // onScrollTo was triggered
            this._state.start = 0;
        }
        change = Math.abs(change);
        if (this._state.end !== -1) {
            if (change >= this._vSB.maxSlowDistancePx) {
                // Calculate considering scale
                this._state.start += Math.round((change / this._vSB.scale) / this._vSB.itemHeight) * direction;
                if (this._state.start < 0) {
                    this._state.start = 0;
                } else if (this._state.start > this._storageInfo.count - this._state.count - 1) {
                    this._state.start = (this._storageInfo.count - this._state.count) > 0 ? (this._storageInfo.count - this._state.count) : 0;
                }
            } else {
                // Check minimal scrollTop
                if (change < this._vSB.itemHeight) {
                    change = this._vSB.itemHeight;
                }
                // Calculate without scale
                this._state.start += Math.round(change / this._vSB.itemHeight) * direction;
                if (this._state.start < 0) {
                    this._state.start = 0;
                } else if (this._state.start > this._storageInfo.count - this._state.count) {
                    this._state.start = (this._storageInfo.count - this._state.count) > 0 ? (this._storageInfo.count - this._state.count) : 0;
                }
            }
        } else {
            this._state.start = (this._storageInfo.count - this._state.count) > 0 ? (this._storageInfo.count - this._state.count) : 0;
        }
        // Recalculate scroll top
        scrollTop = Math.round((this._state.start * this._vSB.itemHeight) * this._vSB.scale);
        // Check minimal offset from top
        if (scrollTop < minScrollTop) {
            scrollTop = minScrollTop;
        }
        // Check minimal offset from bottom
        if (scrollTop > maxScrollTop) {
            scrollTop = maxScrollTop;
        }
        this._state.end = this._state.start + this._state.count;
        if (this._state.end > this._storageInfo.count - 1) {
            this._state.end = this._storageInfo.count - 1;
            this._state.start = (this._storageInfo.count - this._state.count) > 0 ? (this._storageInfo.count - this._state.count) : 0;
        }
        // Set margin
        this._vSB.offset = scrollTop;
        // Drop cache
        this._vSB.cache = scrollTop;
        // Change real scroll
        target.scrollTop = scrollTop;
        return true;
    }

    private _scrollWithoutScale(target: HTMLElement, scrollTop: number): boolean {
        const minScrollTop = 1;
        const maxScrollTop = this._vSB.heightFiller - this._containerSize.height - 1;
        let change: number = this._vSB.cache === -1 ? scrollTop : (scrollTop - this._vSB.cache);
        const direction: number = change > 0 ? 1 : -1;
        if (direction < 0 && this._state.start === 0) {
            // Already beginning of list
            scrollTop = minScrollTop;
            target.scrollTop = scrollTop;
            this._vSB.cache = scrollTop;
            return false;
        }
        if (direction > 0 && this._state.end === this._storageInfo.count - 1) {
            // Already end of list
            scrollTop = maxScrollTop;
            target.scrollTop = scrollTop;
            this._vSB.cache = scrollTop;
            return false;
        }
        if (this._state.start === -1) {
            // onScrollTo was triggered
            this._state.start = 0;
        }
        change = Math.abs(change);
        change = change < this._vSB.itemHeight ? this._vSB.itemHeight : change;
        this._state.start += Math.round(change / this._vSB.itemHeight) * direction;
        if (this._state.start < 0) {
            this._state.start = 0;
        } else if (this._state.start > this._storageInfo.count - this._state.count) {
            this._state.start = (this._storageInfo.count - this._state.count) > 0 ? (this._storageInfo.count - this._state.count) : 0;
        }
        scrollTop = this._state.start * this._vSB.itemHeight;
        // Check minimal offset from top
        if (scrollTop < minScrollTop) {
            scrollTop = minScrollTop;
        }
        // Check minimal offset from bottom
        if (scrollTop > maxScrollTop) {
            scrollTop = maxScrollTop;
        }
        this._state.end = this._state.start + this._state.count;
        if (this._state.end > this._storageInfo.count - 1) {
            this._state.end = this._storageInfo.count - 1;
            this._state.start = (this._storageInfo.count - this._state.count) > 0 ? (this._storageInfo.count - this._state.count) : 0;
        }
        // Set margin
        this._vSB.offset = scrollTop;
        // Drop cache
        this._vSB.cache = scrollTop;
        // Set scroll top
        target.scrollTop = scrollTop;
        return true;
    }

    private _updateContainerSize(force: boolean = false) {
        if (this._ng_nodeContainer === undefined) {
            return;
        }
        if (!force && this._containerSize !== undefined) {
            return;
        }
        this._containerSize = (this._ng_nodeContainer.nativeElement as HTMLElement).getBoundingClientRect();
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
        if (scrollHeight < Settings.maxScrollHeight) {
            this._vSB.scale = 1;
            this._vSB.heightFiller = scrollHeight;
        } else {
            this._vSB.scale = Settings.maxScrollHeight / scrollHeight;
            this._vSB.heightFiller = Settings.maxScrollHeight;
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

    private _onScrollTo(row: number) {
        // Correct row value
        row = row > this._storageInfo.count - 1 ? (this._storageInfo.count - 1) : row;
        row = row < 0 ? 0 : row;
        // Drop frame to begin
        this._state.start = -1;
        // Drop cache
        this._vSB.cache = -1;
        // Detect start of frame
        let start: number = row - Settings.scrollToOffset > 0 ? (row - Settings.scrollToOffset) : 0;
        if (start + this._state.count > this._storageInfo.count - 1) {
            start = this._storageInfo.count - 1 - this._state.count;
            this._state.end = -1;
        }
        // Calculate scale
        const scrollTop = Math.round((start * this._vSB.itemHeight) * this._vSB.scale);
        this._ng_nodeContainer.nativeElement.scrollTop = scrollTop;
    }

    private _onStorageUpdated(info: IStorageInformation) {
        let shouldBeUpdated: boolean;
        if (this._state.start + this._state.count > info.count - 1) {
            this._state.end = info.count - 1;
            shouldBeUpdated = true;
        } else if (this._storageInfo.count < this._state.count && info.count > this._state.count) {
            this._state.end = this._state.start + this._state.count;
            shouldBeUpdated = true;
        }
        this._storageInfo.count = info.count;
        // Scroll bar
        this._updateVSB();
        if (shouldBeUpdated) {
            // Render
            this._render();
            // Notification: scroll is done
            this.API.updatingDone({ start: this._state.start, end: this._state.end });
        }
    }

    private _render() {
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

}
