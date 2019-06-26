import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { IColumnValue } from '../../services/service.columns';
import { SafeHtml, DomSanitizer } from '@angular/platform-browser';
export declare class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    private _sanitizer;
    ipc: Toolkit.PluginIPC;
    session: string;
    _ng_columns: IColumnValue[];
    _ng_arguments: SafeHtml[];
    private _subscriptions;
    constructor(_cdRef: ChangeDetectorRef, _sanitizer: DomSanitizer);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    private _onSelected;
    private _setColumns;
    private _hasArguments;
}
