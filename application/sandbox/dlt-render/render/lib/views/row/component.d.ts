import { OnDestroy, ChangeDetectorRef, AfterViewInit, AfterContentInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';
import { IColumnValue } from '../../services/service.columns';
export declare class DLTRowComponent implements AfterViewInit, OnDestroy, AfterContentInit {
    private _cdRef;
    private _sanitizer;
    ipc: Toolkit.PluginIPC;
    session: string;
    html: string;
    update: Subject<{
        [key: string]: any;
    }>;
    _ng_columns: IColumnValue[];
    _ng_widths: {
        [key: number]: number;
    };
    private _cachedMouseX;
    private _resizedColumnKey;
    private _values;
    private _subscriptions;
    private _guid;
    constructor(_cdRef: ChangeDetectorRef, _sanitizer: DomSanitizer);
    onClick(event: MouseEvent): void;
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    ngAfterContentInit(): void;
    _ng_getWidth(key: number): string;
    _ng_onMouseDown(key: number, event: MouseEvent): void;
    private _setColumns;
    private _onWindowMouseMove;
    private _onWindowMouseUp;
    private _subscribeToWinEvents;
    private _unsubscribeToWinEvents;
    private _offsetResizedColumnWidth;
    private _onColumnsResized;
    private _onInputsUpdated;
}
