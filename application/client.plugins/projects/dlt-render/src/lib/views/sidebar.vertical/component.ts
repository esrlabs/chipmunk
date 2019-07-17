// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription } from 'rxjs';
import { SafeHtml, DomSanitizer } from '@angular/platform-browser';

@Component({
    selector: Toolkit.EViewsTypes.sidebarVertical,
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalComponent implements AfterViewInit, OnDestroy {

    @Input() public api: Toolkit.PluginIPC;
    @Input() public session: string;

    public _ng_columns: Array<{ name: string, html: SafeHtml }> = [];
    public _ng_arguments: SafeHtml[] = [];

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterViewInit() {
        // this._setColumns(ServiceColumns.getSelected());
        // this._subscriptions.onSelected = ServiceColumns.getObservable().onSelected.subscribe(this._onSelected.bind(this));
        this._cdRef.detectChanges();
    }
    /*
    private _onSelected(columns: IColumnValue[]) {
        this._setColumns(columns);
        this._cdRef.detectChanges();
    }

    private _setColumns(columns: IColumnValue[]) {
        let payloadStrValue: string = '';
        this._ng_columns = columns.filter((column: IColumnValue) => {
            if (this._hasArguments(column.str)) {
                payloadStrValue += column.str;
            }
            return true;
        });
        if (payloadStrValue.trim() === '') {
            return;
        }
        this._ng_arguments = payloadStrValue.split(CDelimiters.arguments).map((arg: string) => {
            return this._sanitizer.bypassSecurityTrustHtml(arg);
        });
    }

    private _hasArguments(str: string): boolean {
        return str.indexOf(CDelimiters.arguments) !== -1;
    }
    */
}
