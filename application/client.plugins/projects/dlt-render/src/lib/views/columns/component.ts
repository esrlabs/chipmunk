// tslint:disable:no-inferrable-types
// tslint:disable:max-line-length

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, HostBinding, AfterContentInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription, Subject } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';
import ServiceColumns, { IColumnsWidthsChanged, CDefaults, IColumnValue, CDelimiters } from '../../services/service.columns';

@Component({
    selector: 'lib-dlt-columns-component',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DLTColumnsComponent implements AfterViewInit, OnDestroy, AfterContentInit {

    @Input() public ipc: Toolkit.PluginIPC;
    @Input() public api: Toolkit.IAPI;
    @Input() public session: string;

    public _ng_columns: string[] = [];
    public _ng_widths: { [key: number]: number } = {};
    public _ng_offset: number = 0;

    private _cachedMouseX: number = -1;
    private _resizedColumnKey: number = -1;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _guid: string = Toolkit.guid();
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        this._setRankOffset = this._setRankOffset.bind(this);
        this._subscriptions.onColumnsResized = ServiceColumns.getObservable().onColumnsResized.subscribe(this._onColumnsResized.bind(this));
    }

    public ngOnDestroy() {
        this._destroyed = true;
        this._unsubscribeToWinEvents();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterViewInit() {
        this._ng_columns = ServiceColumns.getColumnsTitles();
        this._ng_widths = ServiceColumns.getWidths(this._ng_columns.length);
        this._setRankOffset();
        this._forceUpdate();
    }

    public ngAfterContentInit() {
    }

    public _ng_getWidth(key: number): string {
        if (this._ng_widths[key] === undefined) {
            return `${CDefaults.width}px`;
        }
        return `${this._ng_widths[key]}px`;
    }

    public _ng_onMouseDown(key: number, event: MouseEvent) {
        this._subscribeToWinEvents();
        this._cachedMouseX = event.x;
        this._resizedColumnKey = key;
    }

    public _ng_getOffset(): string {
        return `${this._ng_offset}px`;
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
        this._forceUpdate();
    }

    private _onColumnsResized(event: IColumnsWidthsChanged) {
        if (this._destroyed) {
            return;
        }
        if (event.emitter === this._guid) {
            return;
        }
        if (Object.keys(this._ng_widths).length !== Object.keys(event.widths).length) {
            return;
        }
        this._ng_widths = Object.assign({}, event.widths);
        this._forceUpdate();
    }

    private _setRankOffset() {
        const rowNumberNode: HTMLElement | null | undefined = document.querySelector('#main-output-row-number');
        if (rowNumberNode === undefined || rowNumberNode === null) {
            return;
        }
        const size: ClientRect = rowNumberNode.getBoundingClientRect();
        if (size.width === 0) {
            // Try once again
            setTimeout(this._setRankOffset, 150);
            return;
        }
        this._ng_offset = Math.round(size.width);
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }


}
