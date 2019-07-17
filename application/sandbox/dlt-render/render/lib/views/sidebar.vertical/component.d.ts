import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { SafeHtml, DomSanitizer } from '@angular/platform-browser';
export declare class SidebarVerticalComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    private _sanitizer;
    api: Toolkit.PluginIPC;
    session: string;
    _ng_columns: Array<{
        name: string;
        html: SafeHtml;
    }>;
    _ng_arguments: SafeHtml[];
    private _subscriptions;
    constructor(_cdRef: ChangeDetectorRef, _sanitizer: DomSanitizer);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
}
