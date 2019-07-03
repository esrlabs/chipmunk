// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, HostListener } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';
import ServiceColumns, { IColumnsWidthsChanged, CDefaults, IColumnValue, CDelimiters } from '../../services/service.columns';

@Component({
    selector: 'lib-dlt-row-component',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DLTRowComponent implements AfterViewInit, OnDestroy {

    @Input() public ipc: Toolkit.PluginIPC;
    @Input() public session: string;
    @Input() public html: string;

    public _ng_columns: IColumnValue[] = [];
    public _ng_widths: { [key: number]: number } = {};

    private _cachedMouseX: number = -1;
    private _resizedColumnKey: number = -1;
    private _values: string[] = [];
    private _subscriptions: { [key: string]: Subscription } = {};
    private _guid: string = Toolkit.guid();

    constructor(private _cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {

    }

    @HostListener('click', ['$event'])

    public onClick(event: MouseEvent) {
        ServiceColumns.emit({ selected: this._ng_columns.slice() }).onSelected.next(this._ng_columns);
    }

    public ngOnDestroy() {
        this._unsubscribeToWinEvents();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterViewInit() {
        if (typeof this.html !== 'string') {
            return;
        }
        this._subscribeToWinEvents();
        this._ng_columns = this.html.split(CDelimiters.columns).map((column: string) => {
            return {
                html: this._sanitizer.bypassSecurityTrustHtml(column),
                str: column,
            };
        });
        this._ng_widths = ServiceColumns.getWidths(this._ng_columns.length);
        this._subscriptions.onColumnsResized = ServiceColumns.getObservable().onColumnsResized.subscribe(this._onColumnsResized.bind(this));
        this._cdRef.detectChanges();
    }

    public _ng_getWidth(key: number): string {
        if (this._ng_widths[key] === undefined) {
            return `${CDefaults.width}px`;
        }
        return `${this._ng_widths[key]}px`;
    }

    public _ng_onMouseDown(key: number, event: MouseEvent) {
        this._cachedMouseX = event.x;
        this._resizedColumnKey = key;
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
        if (this._ng_widths[this._resizedColumnKey] === undefined) {
            return;
        }
        const width: number = this._ng_widths[this._resizedColumnKey] - offset;
        this._ng_widths[this._resizedColumnKey] = width < CDefaults.min ? CDefaults.min : width;
        ServiceColumns.emit({ widths: this._ng_widths }).onColumnsResized.next({
            emitter: this._guid,
            widths: this._ng_widths,
        });
        this._cdRef.detectChanges();
    }

    private _onColumnsResized(event: IColumnsWidthsChanged) {
        if (event.emitter === this._guid) {
            return;
        }
        if (Object.keys(this._ng_widths).length !== Object.keys(event.widths).length) {
            return;
        }
        this._ng_widths = Object.assign({}, event.widths);
        this._cdRef.detectChanges();
    }


}
