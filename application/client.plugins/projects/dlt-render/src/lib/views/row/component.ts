// tslint:disable:no-inferrable-types
// tslint:disable:max-line-length

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, HostListener, AfterContentInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription, Subject } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';
import ServiceColumns, { IColumnsWidthsChanged, CDefaults, IColumnValue, CDelimiters } from '../../services/service.columns';

@Component({
    selector: 'lib-dlt-row-component',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DLTRowComponent implements AfterViewInit, OnDestroy, AfterContentInit {

    @Input() public ipc: Toolkit.PluginIPC;
    @Input() public api: Toolkit.IAPI;
    @Input() public session: string;
    @Input() public html: string;
    @Input() public update: Subject<{ [key: string]: any }>;

    public _ng_columns: IColumnValue[] = [];
    public _ng_widths: { [key: number]: number } = {};

    private _subscriptions: { [key: string]: Subscription } = {};
    private _guid: string = Toolkit.guid();
    private _destroyed: boolean = false;
    private _inited: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        this._subscriptions.onColumnsResized = ServiceColumns.getObservable().onColumnsResized.subscribe(this._onColumnsResized.bind(this));
    }

    @HostListener('click', ['$event']) public onClick(event: MouseEvent) {
        ServiceColumns.emit({ selected: this._ng_columns.slice() }).onSelected.next(this._ng_columns);
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterViewInit() {
        if (typeof this.html !== 'string') {
            return;
        }
        const columns: string[] = this.html.split(CDelimiters.columns);
        this._ng_columns = columns.map((column: string, index: number) => {
            if (index === columns.length - 1) {
                column = column.replace(/\u0005/gi, '');
            }
            return {
                html: this._sanitizer.bypassSecurityTrustHtml(column),
                str: column,
            };
        });
        this._ng_widths = ServiceColumns.getWidths(this._ng_columns.length);
        this._inited = true;
    }

    public ngAfterContentInit() {
        if (this.update === undefined) {
            return;
        }
        this._subscriptions.update = this.update.asObservable().subscribe(this._onInputsUpdated.bind(this));
        ServiceColumns.setTitles(this.api);
    }

    public _ng_getWidth(key: number): string {
        if (this._ng_widths[key] === undefined) {
            return `${CDefaults.width}px`;
        }
        return `${this._ng_widths[key]}px`;
    }

    private _setColumns(update: boolean = false) {
        if (typeof this.html !== 'string') {
            return;
        }
        this._ng_columns = this.html.split(CDelimiters.columns).map((column: string) => {
            return {
                html: this._sanitizer.bypassSecurityTrustHtml(column),
                str: column,
            };
        });
        if (!update) {
            this._ng_widths = ServiceColumns.getWidths(this._ng_columns.length);
            this._subscriptions.onColumnsResized = ServiceColumns.getObservable().onColumnsResized.subscribe(this._onColumnsResized.bind(this));
        }
    }

    private _onColumnsResized(event: IColumnsWidthsChanged) {
        if (!this._inited || this._destroyed) {
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

    private _onInputsUpdated(inputs: any) {
        if (inputs === undefined || inputs === null) {
            return;
        }
        if (typeof inputs.html === 'string' && inputs.html !== this.html) {
            this.html = inputs.html;
            this._setColumns();
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }


}
