import { OnDestroy, ChangeDetectorRef, AfterViewInit, AfterContentInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import * as Toolkit from 'logviewer.client.toolkit';
export declare class DLTColumnsComponent implements AfterViewInit, OnDestroy, AfterContentInit {
    private _cdRef;
    private _sanitizer;
    ipc: Toolkit.PluginIPC;
    api: Toolkit.IAPI;
    session: string;
    _ng_columns: string[];
    _ng_widths: {
        [key: number]: number;
    };
    _ng_offset: number;
    private _cachedMouseX;
    private _resizedColumnKey;
    private _subscriptions;
    private _guid;
    private _destroyed;
    constructor(_cdRef: ChangeDetectorRef, _sanitizer: DomSanitizer);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    ngAfterContentInit(): void;
    _ng_getWidth(key: number): string;
    _ng_onMouseDown(key: number, event: MouseEvent): void;
    _ng_getOffset(): string;
    private _onWindowMouseMove;
    private _onWindowMouseUp;
    private _subscribeToWinEvents;
    private _unsubscribeToWinEvents;
    private _offsetResizedColumnWidth;
    private _onColumnsResized;
    private _setRankOffset;
    private _forceUpdate;
}
