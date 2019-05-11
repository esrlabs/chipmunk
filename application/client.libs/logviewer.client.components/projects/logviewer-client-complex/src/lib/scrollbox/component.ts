// tslint:disable:max-line-length
// tslint:disable:no-inferrable-types
// tslint:disable:component-selector

import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, ViewChild, Input, AfterContentInit, ElementRef, OnChanges } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { ComplexScrollBoxSBVComponent } from './sbv/component';
import { ComplexScrollBoxSBHComponent } from './sbh/component';

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
    ArrowLeft = 'ArrowLeft',
    ArrowRight = 'ArrowRight',
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

@Component({
    selector: 'lib-complex-scrollbox',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ComplexScrollBoxComponent implements OnDestroy, AfterContentInit, OnChanges {

    @ViewChild('container') _ng_nodeContainer: ElementRef;
    @ViewChild('holder') _ng_nodeHolder: ElementRef;
    @ViewChild(ComplexScrollBoxSBVComponent) _ng_sbvCom: ComplexScrollBoxSBVComponent;
    @ViewChild(ComplexScrollBoxSBHComponent) _ng_sbhCom: ComplexScrollBoxSBHComponent;

    @Input() public API: IDataAPI | undefined;
    @Input() public settings: ISettings | undefined;

    public _ng_rows: Array<IRow | number> = [];
    public _ng_factory: any;
    public _ng_rowHeight: number = 0;
    public _ng_horOffset: number = 0;
    public _containerSize: IBoxSize | undefined;
    public _holderSize: { width: number, hash: string } = { width: 0, hash: '' };

    private _settings: ISettings = DefaultSettings;
    private _storageInfo: IStorageInformation | undefined;
    private _subscriptions: { [key: string]: Subscription | undefined } = { };

    private _item: {
        height: number,
    } = {
        height: 0,
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

    private _renderState: {
        timer: any,
        requests: number,
    } = {
        timer: -1,
        requests: 0,
    };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
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
        this._item.height = this.API.getItemHeight();
        this._ng_rowHeight = this._item.height;
        // Update data about sizes
        this._updateContainerSize();
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
        this._ng_sbv_update = this._ng_sbv_update.bind(this);
        this._ng_sbv_pgUp = this._ng_sbv_pgUp.bind(this);
        this._ng_sbv_pgDown = this._ng_sbv_pgDown.bind(this);
        this._updateSbvPosition = this._updateSbvPosition.bind(this);
        this._ng_sbv_getRowsCount = this._ng_sbv_getRowsCount.bind(this);
        this._ng_sbh_update = this._ng_sbh_update.bind(this);
        this._ng_sbh_left = this._ng_sbh_left.bind(this);
        this._ng_sbh_right = this._ng_sbh_right.bind(this);
        this._updateSbvPosition();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._ng_rows = [];
    }

    public ngOnChanges() {
    }

    public _ng_getHolderStyles(): { [key: string]: any } {
        return {
            marginLeft: `-${this._ng_horOffset}px`,
        };
    }

    public _ng_isRowPending(row: IRow): boolean {
        return typeof row === 'number';
    }

    public _ng_isSBVVisible(): boolean {
        return this._state.count < this._storageInfo.count;
    }

    public _ng_isSBHVisible(): boolean {
        if (this._holderSize.width > this._containerSize.width) {
            return true;
        }
        if (this._ng_horOffset !== 0) {
            this._ng_horOffset = 0;
            this._cdRef.detectChanges();
        }
        return false;
    }

    public _ng_onBrowserWindowResize(event?: Event) {
        // Update data about sizes
        this._updateContainerSize(true);
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

    public _ng_onWheel(event: WheelEvent) {
        this._ng_sbv_update(Math.abs(event.deltaY), event.deltaY > 0 ? 1 : -1);
        event.preventDefault();
        return false;
    }

    public _ng_onKeyDown(event: KeyboardEvent) {
        if ([EKeys.ArrowLeft, EKeys.ArrowRight, EKeys.ArrowDown, EKeys.ArrowUp, EKeys.End, EKeys.Home, EKeys.PageDown, EKeys.PageUp].indexOf(event.key as EKeys) === -1) {
            return true;
        }
        event.preventDefault();
        this._onKeyboardAction(event.key as EKeys);
        return false;
    }

    public _ng_getItemStyles(): { [key: string]: any } {
        return {
            height: `${this._item.height}px`,
        };
    }

    public _ng_sbv_update(change: number, direction: number) {
        if (this._state.start === 0 && direction < 0) {
            return;
        }
        // Calculate first row
        let offset: number = Math.round(change / this._item.height);
        if (offset === 0) {
            offset = 1;
        }
        this._setFrame(this._state.start + offset * direction);
        // Render
        this._softRender();
    }

    public _ng_sbv_pgUp() {
        this._onKeyboardAction(EKeys.PageUp);
    }

    public _ng_sbv_pgDown() {
        this._onKeyboardAction(EKeys.PageDown);
    }

    public _ng_sbv_getRowsCount(): number {
        return this._storageInfo.count;
    }

    public _ng_sbh_left() {
        this._ng_sbhCom.toLeft();
    }

    public _ng_sbh_right() {
        this._ng_sbhCom.toRight();
    }

    public _ng_sbh_update(offset: number) {
        this._ng_horOffset = offset;
        this._cdRef.detectChanges();
    }

    private _setFrame(start: number) {
        this._state.start = start;
        if (this._state.start < 0) {
            this._state.start = 0;
        }
        this._state.end = this._state.start + this._state.count;
        if (this._state.end > this._storageInfo.count - 1) {
            this._state.end = this._storageInfo.count - 1;
            this._state.start = (this._storageInfo.count - this._state.count) > 0 ? (this._storageInfo.count - this._state.count) : 0;
        }
    }

    private _onKeyboardAction(key: EKeys) {
        switch (key) {
            case EKeys.ArrowLeft:
                this._ng_sbh_left();
                break;
            case EKeys.ArrowRight:
                this._ng_sbh_right();
                break;
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
        this._state.count = Math.floor(this._containerSize.height / this._item.height);
    }

    private _updateHolderSize(ignoreHash: boolean = false) {
        if (this._ng_nodeHolder === undefined) {
            return;
        }
        const hash: string = `${this._state.start}-${this._state.end}`;
        if (this._holderSize.hash === hash && !ignoreHash) {
            return;
        }
        this._holderSize.hash = hash;
        this._holderSize.width = (this._ng_nodeHolder.nativeElement as HTMLElement).getBoundingClientRect().width;
        this._cdRef.detectChanges();
    }

    private _updateSbvPosition() {
        if (this._ng_sbvCom === undefined || this._ng_sbvCom === null) {
            return;
        }
        this._ng_sbvCom.setFrame(this._state.start, this._state.end, this._storageInfo.count);
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
        // Update holder size
        this._updateHolderSize(true);
    }

    private _onScrollTo(row: number, noOffset: boolean = false) {
        // Correct row value
        row = row > this._storageInfo.count - 1 ? (this._storageInfo.count - 1) : row;
        row = row < 0 ? 0 : row;
        // Detect start of frame
        const start: number = noOffset ? row : (row - this._settings.scrollToOffset > 0 ? (row - this._settings.scrollToOffset) : 0);
        // Set frame
        this._setFrame(start);
        // Trigger scrolling
        this._ng_sbv_update(0, 0);
    }

    private _reset() {
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
        this._updateSbvPosition();
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

    private _softRender() {
        clearTimeout(this._renderState.timer);
        if (this._renderState.requests > 10) {
            this._renderState.requests = 0;
            this._render();
        } else {
            this._renderState.requests += 1;
            this._renderState.timer = setTimeout(this._render.bind(this), 0);
        }
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
        this._updateSbvPosition();
        this._cdRef.detectChanges();
        // Notification: scroll is done
        this.API.updatingDone({ start: this._state.start, end: this._state.end });
        // Update holder size
        this._updateHolderSize();
    }

    private _onRedraw() {
        this._ng_onBrowserWindowResize();
    }

}

