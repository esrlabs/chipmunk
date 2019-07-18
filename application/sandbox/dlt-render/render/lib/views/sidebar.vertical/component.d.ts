import { OnDestroy, ChangeDetectorRef, AfterViewInit, AfterContentInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { SafeHtml, DomSanitizer } from '@angular/platform-browser';
export declare class SidebarVerticalComponent implements AfterViewInit, OnDestroy, AfterContentInit {
    private _cdRef;
    private _sanitizer;
    api: Toolkit.IAPI;
    session: string;
    _ng_columns: Array<{
        name: string;
        html: SafeHtml;
    }>;
    _ng_arguments: SafeHtml[];
    private _subscriptions;
    private _destroyed;
    constructor(_cdRef: ChangeDetectorRef, _sanitizer: DomSanitizer);
    ngOnDestroy(): void;
    ngAfterContentInit(): void;
    ngAfterViewInit(): void;
    private _onRowSelected;
    private _forceUpdate;
}
