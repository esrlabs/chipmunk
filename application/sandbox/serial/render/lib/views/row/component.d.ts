import { OnDestroy, ChangeDetectorRef, AfterViewInit, AfterContentInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as Toolkit from 'chipmunk.client.toolkit';
import { Subject } from 'rxjs';
export declare class SerialRowComponent implements AfterViewInit, OnDestroy, AfterContentInit {
    private _cdRef;
    private _sanitizer;
    api: Toolkit.IAPI;
    session: string;
    html: string;
    update: Subject<{
        [key: string]: any;
    }>;
    _ng_html: SafeHtml;
    _ng_color: string;
    _ng_title: string;
    private _subscriptions;
    private _destroyed;
    constructor(_cdRef: ChangeDetectorRef, _sanitizer: DomSanitizer);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    ngAfterContentInit(): void;
    private _onInputsUpdated;
    private _getHTML;
    private _forceUpdate;
}
