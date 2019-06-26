import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as Toolkit from 'logviewer.client.toolkit';
export declare class DLTRowComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    private _sanitizer;
    ipc: Toolkit.PluginIPC;
    session: string;
    html: string;
    _ng_columns: SafeHtml[];
    _ng_widths: {
        [key: number]: number;
    };
    private _cachedMouseX;
    private _resizedColumnKey;
    private _subscriptions;
    private _guid;
    constructor(_cdRef: ChangeDetectorRef, _sanitizer: DomSanitizer);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    _ng_getWidth(key: number): string;
    _ng_onMouseDown(key: number, event: MouseEvent): void;
    private _onWindowMouseMove;
    private _onWindowMouseUp;
    private _subscribeToWinEvents;
    private _unsubscribeToWinEvents;
    private _offsetResizedColumnWidth;
    private _onColumnsResized;
}
