import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, HostListener, AfterContentInit } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { ControllerColumns, IColumn, IColumns } from '../controller.columns';
import { ControllerSessionScope } from '../../../../../controller/controller.session.tab.scope';
import { ControllerSessionTabStreamOutput } from '../../../../../controller/controller.session.tab.stream.output';
import { IRowNumberWidthData, CRowNumberWidthKey } from '../../component';
import ContextMenuService from '../../../../../services/standalone/service.contextmenu';
import { ViewOutputRowColumnsHeadersMenuComponent } from './menu/component';

export const CColumnsHeadersKey = 'CColumnsHeadersKey';

@Component({
    selector: 'app-views-output-row-columns-headers',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewOutputRowColumnsHeadersComponent implements AfterViewInit, OnDestroy, AfterContentInit {

    @Input() public controller: ControllerColumns;
    @Input() public scope: ControllerSessionScope | undefined;
    @Input() public output: ControllerSessionTabStreamOutput | undefined;

    public _ng_offset: number = 0;
    public _ng_horScrollOffset: number = 0;
    public _ng_columns: IColumn[] = [];

    private _columns: IColumns = {};
    private _cachedMouseX: number = -1;
    private _resizedColumnKey: number = -1;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;
    private _timer: any = -1;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    @HostListener('contextmenu', ['$event']) public _ng_onContextMenu(event: MouseEvent) {
        ContextMenuService.show({
            component: {
                factory: ViewOutputRowColumnsHeadersMenuComponent,
                resolved: false,
                inputs: {
                    controller: this.controller
                }
            },
            x: event.pageX,
            y: event.pageY,
        });
    }

    public ngOnDestroy() {
        this._destroyed = true;
        clearTimeout(this._timer);
        this._unsubscribeToWinEvents();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this.scope.set(CColumnsHeadersKey, false);
    }

    public ngAfterViewInit() {
        if (this.controller === undefined) {
            return;
        }
        this._subscriptions.onHorScrollOffset = this.output.getObservable().onHorScrollOffset.subscribe(this._onHorScrollOffset.bind(this));
        this._subscriptions.onResized = this.controller.getObservable().onResized.subscribe(this._onResized.bind(this));
        this._subscriptions.onVisibility = this.controller.getObservable().onVisibility.subscribe(this._onVisibility.bind(this));
        this._subscriptions.onRankChanged = this.output.getObservable().onRankChanged.subscribe(this._onRankChanged.bind(this));
        this._columns = this.controller.getColumns();
        this._setColumns();
        this._forceUpdate();
    }

    public ngAfterContentInit() {
        this._getOffset();
    }

    public _ng_getWidth(key: number): string {
        return `${this._columns[key].width}px`;
    }

    public _ng_onMouseDown(key: number, event: MouseEvent) {
        this._subscribeToWinEvents();
        this._cachedMouseX = event.x;
        this._resizedColumnKey = key;
    }

    public _ng_getOffset(): string {
        return `${this._ng_offset}px`;
    }

    public _ng_getHorScrollOffset(): string {
        return `-${this._ng_horScrollOffset}px`;
    }

    private _setColumns() {
        this._ng_columns = [];
        Object.keys(this._columns).forEach((key: string) => {
            if (!this._columns[key].visible) {
                return;
            }
            this._ng_columns.push(this._columns[key]);
        });
    }

    private _onWindowMouseMove(event: MouseEvent) {
        if (this._cachedMouseX === -1) {
            return;
        }
        const change: number = this._cachedMouseX - event.x;
        this._cachedMouseX = event.x;
        this._offsetResizedColumnWidth(change);
    }

    private _onWindowMouseUp(event: MouseEvent) {
        if (this._cachedMouseX === -1) {
            return;
        }
        this._cachedMouseX = -1;
        this._resizedColumnKey = -1;
    }

    private _subscribeToWinEvents() {
        this._onWindowMouseMove = this._onWindowMouseMove.bind(this);
        this._onWindowMouseUp = this._onWindowMouseUp.bind(this);
        window.addEventListener('mousemove', this._onWindowMouseMove);
        window.addEventListener('mouseup', this._onWindowMouseUp);
    }

    private _unsubscribeToWinEvents() {
        window.removeEventListener('mousemove', this._onWindowMouseMove);
        window.removeEventListener('mouseup', this._onWindowMouseUp);
    }

    private _offsetResizedColumnWidth(offset: number) {
        if (this._resizedColumnKey === -1) {
            return;
        }
        if (this._columns[this._resizedColumnKey] === undefined) {
            return;
        }
        const width: number = this._columns[this._resizedColumnKey].width - offset;
        this._columns[this._resizedColumnKey].width = width < this._columns[this._resizedColumnKey].minWidth ? this._columns[this._resizedColumnKey].minWidth : width;
        this.controller.resize(this._resizedColumnKey, this._columns[this._resizedColumnKey].width);
        this._forceUpdate();
    }

    private _onResized(columns: IColumns) {
        if (this._destroyed) {
            return;
        }
        this._columns = columns;
        this._forceUpdate();
    }

    private _onVisibility(columns: IColumns) {
        if (this._destroyed) {
            return;
        }
        this._columns = columns;
        this._setColumns();
        this._forceUpdate();
    }

    private _onHorScrollOffset(offset: number) {
        this._ng_horScrollOffset = offset;
        this._forceUpdate();
    }

    private _getOffset(repeatOnNoChange: boolean = false, count: number = 0) {
        clearTimeout(this._timer);
        if (this.scope === undefined) {
            return;
        }
        const info: IRowNumberWidthData | undefined = this.scope.get(CRowNumberWidthKey);
        if (info === undefined) {
            return;
        }
        if (this._ng_offset >= info.width) {
            if (repeatOnNoChange && count < 25) {
                this._timer = setTimeout(() => {
                    // Update with short timeout, because root row component isn't update yet
                    this._getOffset(true, count + 1);
                });
            }
            return;
        }
        this._ng_offset = info.width;
        this._forceUpdate();
    }

    private _onRankChanged() {
        this._getOffset(true);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }


}
