// tslint:disable:max-line-length
// tslint:disable:no-inferrable-types
// tslint:disable:component-selector

import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, ViewChild, Input, AfterContentInit, AfterViewChecked, AfterViewInit, ElementRef, OnChanges } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { ComplexScrollBoxSBVComponent } from './sbv/component';
import { ComplexScrollBoxSBHComponent } from './sbh/component';
import guid from '../../tools/tools.guid';

export interface IScrollBoxSelection {
    selection: string;
    anchor: number;
    focus: number;
}

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
    getLastFrame: () => IRange;
    getStorageInfo: () => IStorageInformation;
    getComponentFactory: () => any;
    getItemHeight: () => number;
    updatingDone: (range: IRange) => void;
    cleanUpClipboard?: (str: string) => string;
    onStorageUpdated: Subject<IStorageInformation>;
    onScrollTo: Subject<number>;
    onScrollUntil: Subject<number>;
    onRowsDelivered: Subject<IRowsPacket>;
    onSourceUpdated: Subject<void>;
    onRerequest: Subject<void>;
    onRedraw: Subject<void>;
}

export interface ISettings {
    minScrollTopScale: number;      // To "catch" scroll event in reverse direction (to up) we should always keep minimal scroll offset
    minScrollTopNotScale: number;   // To "catch" scroll event in reverse direction (to up) we should always keep minimal scroll offset
    maxScrollHeight: number;        // Maximum scroll area height in px.
    scrollToOffset: number;         // How many items show before item defined on scrollTo
    scrollBarSize: number;          // Size of scroll bar: height for horizontal; width for vertical. In px.
}

interface IRowNodeInfo {
    path: string;
    index: number;
}

interface ISelectedNodeInfo {
    index: number;
    path: string;
    offset: number;
    node: Node | undefined;
    fragment: string;
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
    KeyC = 'KeyC',
    KeyX = 'KeyX',
    undefined = 'undefined'
}

const DefaultSettings = {
    minScrollTopScale       : 100,          // To "catch" scroll event in reverse direction (to up) we should always keep minimal scroll offset
    minScrollTopNotScale    : 0,            // To "catch" scroll event in reverse direction (to up) we should always keep minimal scroll offset
    maxScrollHeight         : 100000,       // Maximum scroll area height in px.
    scrollToOffset          : 5,            // How many items show before item defined on scrollTo
    scrollBarSize           : 8,            // Size of scroll bar: height for horizontal; width for vertical. In px.
};

const CRowIndexAttr = 'data-sb-row-index';

export function copyTextToClipboard(text: string) {
    [
        { r: /\u00a0/g, m: '&nbsp;' },
        { r: /\t/g,     m: '&#9;'   },
        { r: /</g,      m: '&lt;'   },
        { r: />/g,      m: '&gt;'   },
        { r: /[\n\r]/g, m: '<br>'   },
        { r: /\s/g,     m: '&nbsp;' }, // &#32;
        { r: /&#9;/g,   m: '\u0009' }
    ].forEach((toBeChecked) => {
        text = text.replace(toBeChecked.r, toBeChecked.m);
    });
    // Oldschool (modern class Clipboard gives exeptions for this moment: 13.09.2019)
    const selection         = document.getSelection();
    const element           = document.createElement('pre'); // This is important to use tag <PRE> - it allows delivery into clipboard such "things" like tabs
    element.style.opacity   = '0.0001';
    element.style.position  = 'absolute';
    element.style.userSelect = 'all';
    element.style.width     = '1px';
    element.style.height    = '1px';
    element.style.overflow  = 'hidden';
    element.className       = 'noreset';
    element.innerHTML       = text;
    document.body.appendChild(element);
    const range             = document.createRange();
    range.selectNode(element);
    selection.empty();
    selection.addRange(range);
    document.execCommand('copy');
    selection.empty();
    document.body.removeChild(element);
}

@Component({
    selector: 'lib-complex-scrollbox',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ComplexScrollBoxComponent implements OnDestroy, AfterContentInit, AfterViewChecked, AfterViewInit, OnChanges {

    @ViewChild('container', {static: false}) _ng_nodeContainer: ElementRef;
    @ViewChild('holder', {static: false}) _ng_nodeHolder: ElementRef;
    @ViewChild(ComplexScrollBoxSBVComponent, {static: false}) _ng_sbvCom: ComplexScrollBoxSBVComponent;
    @ViewChild(ComplexScrollBoxSBHComponent, {static: false}) _ng_sbhCom: ComplexScrollBoxSBHComponent;

    @Input() public API: IDataAPI | undefined;
    @Input() public settings: ISettings | undefined;

    public _ng_rows: Array<IRow | number> = [];
    public _ng_factory: any;
    public _ng_rowHeight: number = 0;
    public _ng_horOffset: number = 0;
    public _ng_horScrolling: boolean = false;
    public _ng_guid: string = guid();
    public _ng_containerSize: IBoxSize | undefined;
    public _ng_holderSize: { width: number, hash: string } = { width: 0, hash: '' };

    private _subjects = {
        onScrolled: new Subject<IRange>(),
        onOffset: new Subject<number>(),
    };

    private _injected: {
        rows: Array<IRow | number>,
        offset: number,
        count: number,
    } = {
        rows: [],
        offset: 0,
        count: 0,
    };
    private _settings: ISettings = DefaultSettings;
    private _storageInfo: IStorageInformation | undefined;
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _destroyed: boolean = false;
    private _horScrollingTimer: any = -1;
    private _localMouseDown: boolean = false;
    private _selection: {
        focus: ISelectedNodeInfo,
        anchor: ISelectedNodeInfo,
        going: boolean,
        out: boolean;
        selection: string | undefined;
        restored: boolean;
        style: HTMLStyleElement | undefined;
    } = {
        focus: { index: -1, path: '', offset: -1, node: undefined, fragment: '' },
        anchor: { index: -1, path: '', offset: -1, node: undefined, fragment: '' },
        going: false,
        out: false,
        selection: undefined,
        restored: true,
        style: undefined,
    };

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
        this._subscriptions.onScrollTo = this.API.onScrollTo.asObservable().subscribe(this._onScrollTo.bind(this, true));
        this._subscriptions.onScrollUntil = this.API.onScrollUntil.asObservable().subscribe(this._onScrollUntil.bind(this));
        this._subscriptions.onStorageUpdated = this.API.onStorageUpdated.asObservable().subscribe(this._onStorageUpdated.bind(this));
        this._subscriptions.onRedraw = this.API.onRedraw.asObservable().subscribe(this._onRedraw.bind(this));
        this._subscriptions.onRerequest = this.API.onRerequest.asObservable().subscribe(this._onRerequest.bind(this));
        this._subscriptions.onSourceUpdated = this.API.onSourceUpdated.asObservable().subscribe(this._onSourceUpdated.bind(this));
        // Init first range
        this._getInitalRange();
        // Binding
        this._ng_sbv_update = this._ng_sbv_update.bind(this);
        this._ng_sbv_pgUp = this._ng_sbv_pgUp.bind(this);
        this._ng_sbv_pgDown = this._ng_sbv_pgDown.bind(this);
        this._updateSbvPosition = this._updateSbvPosition.bind(this);
        this._ng_sbv_getRowsCount = this._ng_sbv_getRowsCount.bind(this);
        this._ng_sbh_update = this._ng_sbh_update.bind(this);
        this._ng_sbh_left = this._ng_sbh_left.bind(this);
        this._ng_sbh_right = this._ng_sbh_right.bind(this);
    }

    public ngAfterViewInit() {
        // Update data about sizes
        this._updateContainerSize(true);
        this._updateHolderSize(true);
        // Update vertical scroll bar
        this._updateSbvPosition();
        // Update
        this._forceUpdate();
    }

    public ngAfterViewChecked() {
        // this._selection_restore();
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._ng_rows = [];
    }

    public ngOnChanges() {
    }

    public setFocus() {
        if (this._ng_nodeContainer === undefined || this._ng_nodeContainer === null) {
            return;
        }
        this._ng_nodeContainer.nativeElement.focus();
    }

    public _ng_onWindowMouseMove(event: MouseEvent) {
        if (!this._selection.going) {
            return;
        }
        this._ng_nodeHolder.nativeElement.focus();
    }

    public _ng_onSelectStart(event: Event) {
        // Set selection as started
        this._ng_nodeHolder.nativeElement.focus();
        this._selection_drop(true);
        this._selection.going = true;
        /*
        this._selection.style = document.createElement('style');
        this._selection.style.type = 'text/css';
        this._selection.style.innerHTML = `
            *:not(#${this._ng_guid}) { user-select: none; }
            ul#${this._ng_guid} * { user-select: text; }
        `;
        document.getElementsByTagName('head')[0].appendChild(this._selection.style);
        */
    }

    public _ng_onWindowMouseUp(event: MouseEvent) {
        if (!this._selection.going) {
            return;
        }
        /*
        // Remove extra styles
        if (this._selection.style !== undefined) {
            if (this._selection.style.parentNode !== null) {
                this._selection.style.parentNode.removeChild(this._selection.style);
            }
            this._selection.style = undefined;
        }
        */
        // Set selection as started
        this._selection.going = false;
        // Check selection
        const selection: Selection = document.getSelection();
        if (selection.toString() === '') {
            this._selection_drop();
        }
    }

    public _ng_onMouseLeaveHolder(event: MouseEvent) {
        this._selection.out = true;
    }

    public _ng_onMouseOverHolder(event: MouseEvent) {
        this._selection.out = false;
    }

    public _ng_onMouseDownHolder(event: MouseEvent) {
        this._localMouseDown = true;
        if (event.button !== 0) {
            return;
        }
        this._selection_drop(true);
    }

    public _ng_onSelectChange(event: Event) {
        if (!this._selection.going) {
            // This selection isn't on element
            return;
        }
        this._ng_nodeHolder.nativeElement.focus();
        if (!this._selection.restored) {
            return false;
        }
        if (this._selection.out) {
            this._selection.restored = false;
            this._selection_UpdateFocus(undefined);
            this._selection_scroll();
            return false;
        }
        const selection: Selection = document.getSelection();
        this._selection_UpdateFocus(selection);
        this._selection_UpdateAnchor(selection);
        this._selection_scroll();
        this._selection_save(selection);
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

    public _ng_onBrowserWindowMouseDown(event: MouseEvent) {
        if (!this._localMouseDown) {
            this._selection_drop(true);
        }
        this._localMouseDown = false;
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
        // Update scrollbar
        if (this._ng_sbvCom !== undefined && this._ng_sbvCom !== null) {
            this._ng_sbvCom.recalc();
        }
    }

    public _ng_onWheel(event: WheelEvent) {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            this._ng_sbh_update(this._ng_horOffset + event.deltaX, true);
        } else {
            this._ng_sbv_update(Math.abs(event.deltaY), event.deltaY > 0 ? 1 : -1, false);
        }
        event.preventDefault();
        return false;
    }

    public _ng_onKeyDown(event: KeyboardEvent) {
        if (event.code === EKeys.KeyC) {
            if (!(event.ctrlKey || event.metaKey)) {
                return true;
            }
        }
        if (event.code === EKeys.KeyX) {
            if (!(event.ctrlKey || event.metaKey)) {
                return true;
            }
        }
        if ([EKeys.KeyC, EKeys.KeyX, EKeys.ArrowLeft, EKeys.ArrowRight, EKeys.ArrowDown, EKeys.ArrowUp, EKeys.End, EKeys.Home, EKeys.PageDown, EKeys.PageUp].indexOf(event.code as EKeys) === -1) {
            return true;
        }
        event.preventDefault();
        this._onKeyboardAction(event.code as EKeys);
        return false;
    }

    public _ng_getItemStyles(): { [key: string]: any } {
        return {
            height: `${this._item.height}px`,
        };
    }

    public _ng_sbv_update(change: number, direction: number, outside: boolean) {
        if (this._state.start === 0 && direction < 0 && this._injected.offset === 0) {
            return;
        }
        // Calculate first row
        let offset: number = Math.round(change / this._item.height);
        if (offset === 0) {
            offset = 1;
        }
        this._setFrame(this._state.start + offset * direction, outside);
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
        this._updateHolderSize();
        this._ng_sbhCom.toLeft();
    }

    public _ng_sbh_right() {
        this._updateHolderSize();
        this._ng_sbhCom.toRight();
    }

    public _ng_sbh_onMouseOver() {
        this._updateHolderSize();
    }

    public _ng_sbh_update(offset: number, setOffsetOnBar: boolean = false) {
        if (this._ng_sbhCom === undefined || this._ng_sbhCom === null) {
            return;
        }
        this._updateHolderSize();
        clearTimeout(this._horScrollingTimer);
        this._ng_horScrolling = true;
        if (offset < 0) {
            offset = 0;
        }
        if (offset > this._ng_holderSize.width - this._ng_containerSize.width + this._ng_sbhCom.getMinOffset()) {
            offset = this._ng_holderSize.width - this._ng_containerSize.width + this._ng_sbhCom.getMinOffset();
        }
        offset = isNaN(offset) ? 0 : (isFinite(offset) ? offset : 0);
        if (this._ng_horOffset !== offset) {
            this._subjects.onOffset.next(offset);
        }
        this._ng_horOffset = offset;
        this._horScrollingTimer = setTimeout(() => {
            this._ng_horScrolling = false;
            this._forceUpdate();
        }, 1000);
        this._forceUpdate();
        if (setOffsetOnBar) {
            this._ng_sbhCom.setOffset(this._ng_horOffset);
        }
    }

    public _ng_getFrameStart(): number {
        return this._state.start;
    }

    public getObservable(): {
        onScrolled: Observable<IRange>,
        onOffset: Observable<number>,
    } {
        return {
            onScrolled: this._subjects.onScrolled.asObservable(),
            onOffset: this._subjects.onOffset.asObservable(),
        };
    }

    public getFrame(): IRange {
        return { start: this._state.start, end: this._state.end };
    }

    public getSelection(): IScrollBoxSelection | undefined {
        if (this._selection.focus.index === -1) {
            return undefined;
        }
        let selection: string = this._selection.selection;
        if (this.API.cleanUpClipboard !== undefined) {
            selection = this.API.cleanUpClipboard(selection);
        }
        return {
            selection: selection,
            anchor: this._selection.anchor.index,
            focus: this._selection.focus.index,
        };
    }

    public copySelection() {
        this._selection_copy();
    }

    private _setFrame(start: number, outside: boolean) {
        this._state.start = start;
        if (this._state.start < 0) {
            this._state.start = 0;
        }
        this._state.end = this._state.start + this._state.count;
        if (this._state.end > this._storageInfo.count - 1) {
            this._state.end = this._storageInfo.count - 1;
            this._state.start = (this._storageInfo.count - this._state.count) > 0 ? (this._storageInfo.count - this._state.count) : 0;
        }
        if (!outside) {
            this._subjects.onScrolled.next({ start: this._state.start, end: this._state.end });
        }
    }

    private _getInitalRange() {
        // Try to get last frame
        const frame: IRange = this.API.getLastFrame();
        if (frame.end - frame.start > this._state.count) {
            frame.end = frame.start + this._state.count;
        }
        if (frame.end > this._storageInfo.count - 1) {
            frame.end = this._storageInfo.count - 1;
            frame.start = frame.end - this._state.count > 0 ? frame.end - this._state.count : 0;
        }
        // Get rows
        const rows = this.API.getRange({
            start: frame.start,
            end: frame.end
        }).rows;
        this._ng_rows = rows;
        this._state.start = frame.start;
        this._state.end = frame.end;
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
                this._onScrollTo(false, this._state.start + 1, true);
                break;
            case EKeys.ArrowUp:
                if (this._state.start - 1 < 0) {
                    return;
                }
                this._onScrollTo(false, this._state.start - 1, true);
                break;
            case EKeys.PageDown:
                if (this._state.start + this._state.count > this._storageInfo.count - 1) {
                    this._onScrollTo(false, this._storageInfo.count - 1, true);
                    return;
                }
                this._onScrollTo(false, this._state.start + this._state.count, true);
                break;
            case EKeys.PageUp:
                if (this._state.start - this._state.count < 0) {
                    this._onScrollTo(false, 0, true);
                    return;
                }
                this._onScrollTo(false, this._state.start - this._state.count, true);
                break;
            case EKeys.End:
                if (this._state.start === this._storageInfo.count - 1) {
                    return;
                }
                this._onScrollTo(false, this._storageInfo.count - 1, true);
                break;
            case EKeys.Home:
                if (this._state.start === 0) {
                    return;
                }
                this._onScrollTo(false, 0, true);
                break;
            case EKeys.KeyC:
            case EKeys.KeyX:
                this._selection_copy();
                this._selection_restore();
                break;
        }
    }

    private _updateContainerSize(force: boolean = false) {
        if (this._ng_nodeContainer === undefined) {
            return;
        }
        if (!force && this._ng_containerSize !== undefined) {
            return;
        }
        this._ng_containerSize = (this._ng_nodeContainer.nativeElement as HTMLElement).getBoundingClientRect();
        this._ng_containerSize.height -= this._settings.scrollBarSize;
        this._state.count = Math.floor(this._ng_containerSize.height / this._item.height);
    }

    private _updateHolderSize(ignoreHash: boolean = false) {
        if (this._ng_nodeHolder === undefined) {
            return;
        }
        const hash: string = `${this._state.start}-${this._state.end}`;
        if (this._ng_holderSize.hash === hash && !ignoreHash) {
            return;
        }
        this._ng_holderSize.hash = hash;
        this._ng_holderSize.width = (this._ng_nodeHolder.nativeElement as HTMLElement).getBoundingClientRect().width;
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
        this._forceUpdate();
        // Update holder size
        this._updateHolderSize(true);
    }

    private _onRerequest() {
        this._render();
        // Update holder size
        this._updateHolderSize(true);
    }

    private _onSourceUpdated() {
        const storage: IStorageInformation = this.API.getStorageInfo();
        // Update storage info
        this._storageInfo.count = storage.count;
        // Read initial state
        this._getInitalRange();
        // Update data about sizes
        this._updateContainerSize(true);
        this._updateHolderSize(true);
        // Update vertical scroll bar
        this._updateSbvPosition();
        // Update
        this._forceUpdate();
    }

    private _onScrollTo(outside: boolean, row: number, noOffset: boolean = false) {
        // Correct row value
        row = row > this._storageInfo.count - 1 ? (this._storageInfo.count - 1) : row;
        row = row < 0 ? 0 : row;
        // Detect start of frame
        const start: number = noOffset ? row : (row - this._settings.scrollToOffset > 0 ? (row - this._settings.scrollToOffset) : 0);
        // Set frame
        this._setFrame(start, outside);
        // Trigger scrolling
        this._ng_sbv_update(0, 0, outside);
    }

    private _onScrollUntil(row: number) {
        // Correct row value
        row = row > this._storageInfo.count - 1 ? (this._storageInfo.count - 1) : row;
        row = row < 0 ? 0 : row;
        // Detect start of frame
        const start: number = row - this._state.count < 0 ? 0 : (row - this._state.count);
        // Set frame
        this._setFrame(start, true);
        // Trigger scrolling
        this._ng_sbv_update(0, 0, true);
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
        if (!this._isStateValid() || ((this._state.end - this._state.start) === 0 && (this._state.end !== 0 || this._state.start !== 0))) {
            // This case can be in case of asynch calls usage
            this._ng_rows = [];
            return this._forceUpdate();
        }
        let requested: number = this._state.end - this._state.start + 1;
        // Correct frame if it's needed
        if (requested < this._state.count && this._storageInfo.count > this._state.count) {
            this._state.start = this._state.end - (this._state.count - 1);
            requested = this._state.end - this._state.start + 1;
        }
        const frame = this.API.getRange({ start: this._state.start, end: this._state.end});
        const rows: Array<IRow | number> = frame.rows;
        const pending = requested - rows.length;
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
        this._forceUpdate();
        // Notification: scroll is done
        this.API.updatingDone({ start: this._state.start, end: this._state.end });
        // Update holder size
        // this._updateHolderSize();
        // Restore selection
        this._selection_restore();
    }

    private _onRedraw() {
        this._ng_onBrowserWindowResize();
    }

    private _selection_UpdateFocus(selection: Selection | undefined) {
        if (selection === undefined) {
            this._selection.focus.offset = 0;
            if (this._selection.focus.index > this._selection.anchor.index) {
                // Direction: down
                this._selection.focus.path = `li[${CRowIndexAttr}="${this._state.end}"]`;
                this._selection.focus.index = this._state.end;
                this._selection.focus.node = this._selection_restore();
            } else if (this._selection.focus.index < this._selection.anchor.index) {
                // Direction: up
                this._selection.focus.path = `li[${CRowIndexAttr}="${this._state.start}"]`;
                this._selection.focus.index = this._state.start;
                this._selection.focus.node = this._selection_restore();
            }
            return;
        }
        if (this._selection.focus.node !== selection.focusNode) {
            const focusRowInfo: IRowNodeInfo | undefined = this._selection_getRowInfo(selection.focusNode as HTMLElement);
            if (focusRowInfo !== undefined) {
                this._selection.focus.path = focusRowInfo.path;
                this._selection.focus.index = focusRowInfo.index;
                this._selection.focus.node = selection.focusNode;
                this._selection.focus.offset = selection.focusOffset;
            } else {
                this._selection.focus.offset = 0;
                if (this._selection.focus.index > this._selection.anchor.index) {
                    // Direction: down
                    this._selection.focus.path = `li[${CRowIndexAttr}="${this._state.end}"]`;
                    this._selection.focus.index = this._state.end;
                    this._selection.focus.node = this._selection_restore();
                } else if (this._selection.focus.index < this._selection.anchor.index) {
                    // Direction: up
                    this._selection.focus.path = `li[${CRowIndexAttr}="${this._state.start}"]`;
                    this._selection.focus.index = this._state.start;
                    this._selection.focus.node = this._selection_restore();
                }
            }
        } else {
            this._selection.focus.offset = selection.focusOffset;
        }
    }

    private _selection_UpdateAnchor(selection: Selection) {
        if (this._selection.anchor.index !== -1) {
            return;
        }
        const anchorRowInfo: IRowNodeInfo | undefined = this._selection_getRowInfo(selection.anchorNode as HTMLElement);
        if (anchorRowInfo !== undefined) {
            this._selection.anchor.path = anchorRowInfo.path;
            this._selection.anchor.index = anchorRowInfo.index;
            this._selection.anchor.node = selection.anchorNode;
            this._selection.anchor.offset = selection.anchorOffset;
        }
    }

    private _selection_save(selection: Selection) {
        if (!this._selection.restored) {
            return;
        }
        if (!this._selection.going) {
            return;
        }
        if (this._selection_isInView()) {
            this._selection.selection = selection.toString();
            return;
        }
        if (this._selection.selection === undefined) {
            return;
        }
        const current: string = selection.toString().replace(/[\n\r]$/, '');
        if (this._selection.focus.index > this._selection.anchor.index) {
            // Direction: down
            const hiddenCount: number = this._state.start - this._selection.anchor.index;
            const hiddenContent: string = this._selection.selection.split(/[\n\r]/).slice(0, hiddenCount).join('\n');
            this._selection.selection = `${hiddenContent}\n${current}`;
        } else if (this._selection.focus.index < this._selection.anchor.index) {
            // Direction: up
            const hiddenCount: number = this._selection.anchor.index - this._state.end + 1;
            const storedRows: string[] = this._selection.selection.split(/[\n\r]/);
            const hiddenContent: string = storedRows.slice(storedRows.length - hiddenCount, storedRows.length).join('\n');
            this._selection.selection = `${current}\n${hiddenContent}`;
        }
    }

    private _selection_getRowInfo(node: HTMLElement, path: string = ''): IRowNodeInfo | undefined {
        if (node === undefined || node === null) {
            return undefined;
        }
        if (node.parentNode === undefined || node.parentNode === null) {
            return undefined;
        }
        if (node.nodeName.toLowerCase() === 'body') {
            return undefined;
        }
        let rowIndex: string | undefined = node.getAttribute === undefined ? undefined : node.getAttribute(CRowIndexAttr);
        rowIndex = rowIndex === null ? undefined : (rowIndex === '' ? undefined : rowIndex);
        if (rowIndex !== undefined) {
            path = `${node.nodeName.toLowerCase()}[${CRowIndexAttr}="${rowIndex}"]${path !== '' ? ' ' : ''}${path}`;
        } else if (node.nodeType === Node.TEXT_NODE) {
            let textNodeIndex: number = -1;
            Array.prototype.forEach.call(node.parentNode.childNodes, (child: Node, index: number) => {
                if (textNodeIndex === -1 && node === child) {
                    textNodeIndex = index;
                }
            });
            if (textNodeIndex === -1) {
                return undefined;
            }
            return this._selection_getRowInfo(node.parentNode as HTMLElement, `#text:${textNodeIndex}`);
        } else if (node.parentNode.children.length !== 0 && rowIndex === undefined) {
            let index: number = -1;
            Array.prototype.forEach.call(node.parentNode.children, (children: Node, i: number) => {
                if (children === node) {
                    index = i;
                }
            });
            if (index === -1) {
                return undefined;
            }
            path = `${node.nodeName.toLowerCase()}:nth-child(${index + 1})${path !== '' ? ' ' : ''}${path}`;
        } else {
            path = `${node.nodeName.toLowerCase()}${path !== '' ? ' ' : ''}${path}`;
        }
        const attr: string | null | undefined = node.getAttribute === undefined ? undefined : node.getAttribute(CRowIndexAttr);
        if (attr === null || attr === undefined) {
            return this._selection_getRowInfo(node.parentNode as HTMLElement, path);
        }
        return { index: parseInt(attr, 10), path: path };
    }

    private _selection_drop(soft: boolean = false) {
        this._selection.focus.path = '';
        this._selection.focus.index = -1;
        this._selection.focus.offset = -1;
        this._selection.focus.node = undefined;
        this._selection.focus.fragment = '';
        this._selection.anchor.path = '';
        this._selection.anchor.index = -1;
        this._selection.anchor.offset = -1;
        this._selection.anchor.node = undefined;
        this._selection.anchor.fragment = '';
        this._selection.going = false;
        this._selection.selection = undefined;
        this._selection.restored = true;
        if (!soft) {
            document.getSelection().removeAllRanges();
        }
    }

    private _selection_scroll() {
        if (!this._selection.going) {
            return;
        }
        if (this._selection.focus.index > this._selection.anchor.index) {
            // Direction: down
            if (this._selection.focus.index >= this._storageInfo.count - 1) {
                this._selection.restored = true;
                return;
            }
            if (this._selection.focus.index >= this._state.end - 1) {
                // Have to do scroll down
                this._selection.restored = false;
                this._onScrollTo(false, this._state.start + 1, true);
            }
        } else if (this._selection.focus.index < this._selection.anchor.index) {
            // Direction: up
            if (this._selection.focus.index === 0) {
                this._selection.restored = true;
                return;
            }
            if (this._selection.focus.index <= this._state.start + 1) {
                // Scroll up
                this._selection.restored = false;
                this._onScrollTo(false, this._state.start - 1, true);
            }
        }
    }

    private _selection_getRowNode(path: string): Node | undefined {
        if (this._ng_nodeHolder === undefined || this._ng_nodeHolder === null) {
            return undefined;
        }
        let selector: string = path;
        let textNodeIndex: number = -1;
        if (selector.indexOf('#text') !== -1) {
            const parts: string[] = selector.split(`#text:`);
            if (parts.length !== 2) {
                return undefined;
            }
            textNodeIndex = parseInt(parts[1], 10);
            if (isNaN(textNodeIndex) || !isFinite(textNodeIndex)) {
                return undefined;
            }
            selector = selector.replace(/#text:\d*/gi, '').trim();
        }
        let node: Node = this._ng_nodeHolder.nativeElement.querySelector(selector);
        if (node === undefined || node === null) {
            return undefined;
        }
        if (textNodeIndex !== -1 && node.childNodes.length === 0) {
            return undefined;
        }
        if (textNodeIndex !== -1 && node.childNodes.length !== 0) {
            node = node.childNodes[textNodeIndex] === undefined ? undefined : node.childNodes[textNodeIndex];
            node = node === undefined ? undefined : (node.nodeType !== Node.TEXT_NODE ? undefined : node);
        }
        return node;
    }

    private _selection_isInView(): boolean {
        if (this._selection.focus.index < this._state.start || this._selection.anchor.index < this._state.start) {
            return false;
        }
        if (this._selection.focus.index > this._state.end || this._selection.anchor.index > this._state.end) {
            return false;
        }
        return true;
    }

    private _selection_copy() {
        if (this._selection.focus.index === -1) {
            return undefined;
        }
        let selection: string = this._selection.selection;
        if (this.API.cleanUpClipboard !== undefined) {
            selection = this.API.cleanUpClipboard(selection);
        }
        copyTextToClipboard(selection);
        this._selection_restore();
    }

    private _selection_restore(): Node | undefined {
        const getMaxOffset = (node: Node): number => {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent.length - 1;
            } else if (node.childNodes !== undefined && node.childNodes !== null) {
                return node.childNodes.length - 1;
            } else {
                return 0;
            }
        };
        if (this._selection.focus.index === -1) {
            this._selection.restored = true;
            return;
        }
        if (this._selection.focus.index < this._state.start && this._selection.anchor.index < this._state.start) {
            this._selection.restored = true;
            return;
        }
        if (this._selection.focus.index > this._state.end && this._selection.anchor.index > this._state.end) {
            this._selection.restored = true;
            return;
        }
        let anchorOffset: number = -1;
        let focusOffset: number = -1;
        let anchorPath: string = '';
        let focusPath: string = '';
        if (this._selection.focus.index === this._selection.anchor.index) {
            anchorOffset = this._selection.anchor.offset;
            focusOffset = this._selection.focus.offset;
            anchorPath = this._selection.anchor.path;
            focusPath = this._selection.focus.path;
        } else if (this._selection.focus.index > this._selection.anchor.index) {
            // Direction: down
            anchorOffset = this._selection.anchor.index < this._state.start ? 0 : this._selection.anchor.offset;
            focusOffset = this._selection.focus.index > this._state.end ? Infinity : this._selection.focus.offset;
            anchorPath = this._selection.anchor.index < this._state.start ? `li[${CRowIndexAttr}="${this._state.start}"]` : this._selection.anchor.path;
            focusPath = this._selection.focus.index > this._state.end ? `li[${CRowIndexAttr}="${this._state.end}"]` : this._selection.focus.path;
        } else if (this._selection.focus.index < this._selection.anchor.index) {
            // Direction: up
            anchorOffset = this._selection.anchor.index > this._state.end ? Infinity : this._selection.anchor.offset;
            focusOffset = this._selection.focus.index < this._state.start ? 0 : this._selection.focus.offset;
            anchorPath = this._selection.anchor.index > this._state.end ? `li[${CRowIndexAttr}="${this._state.end}"]` : this._selection.anchor.path;
            focusPath = this._selection.focus.index < this._state.start ? `li[${CRowIndexAttr}="${this._state.start}"]` : this._selection.focus.path;
        }
        const selection: Selection = document.getSelection();
        selection.removeAllRanges();
        const anchorNode = this._selection_getRowNode(anchorPath);
        const focusNode = this._selection_getRowNode(focusPath);
        if (anchorNode === undefined || focusNode === undefined) {
            return;
        }
        if (!isFinite(anchorOffset)) {
            anchorOffset = getMaxOffset(anchorNode);
        }
        if (!isFinite(focusOffset)) {
            focusOffset = getMaxOffset(focusNode);
        }
        try {
            selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
        } catch (e) {
            let details: string = 'Error with restoring selection:';
            details += `\n\t-\tanchorPath: ${anchorPath}`;
            details += `\n\t-\tfocusNode: ${focusPath}`;
            if (typeof anchorNode.textContent === 'string') {
                details += `\n\t-\t${anchorNode.textContent.length <= anchorOffset ? '[WRONG]' : ''}anchor (${anchorNode.nodeName}): "${anchorNode.textContent}" (${anchorNode.textContent.length}): ${anchorOffset}`;
            }
            if (typeof focusNode.textContent === 'string') {
                details += `\n\t-\t${focusNode.textContent.length <= focusOffset ? '[WRONG]' : ''}focus (${focusNode.nodeName}): "${focusNode.textContent}" (${focusNode.textContent.length}): ${focusOffset}`;
            }
            details += `\n\t-\terror: ${e.message}`;
            console.log(anchorNode);
            console.log(focusNode);
            console.warn(details);

        }
        this._selection.restored = true;
        this._selection_save(selection);
        return focusNode;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

