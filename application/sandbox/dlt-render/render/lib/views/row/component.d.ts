import { OnDestroy, ChangeDetectorRef, AfterViewInit, AfterContentInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';
import { IColumnValue } from '../../services/service.columns';
export declare class DLTRowComponent implements AfterViewInit, OnDestroy, AfterContentInit {
    private _cdRef;
    private _sanitizer;
    ipc: Toolkit.PluginIPC;
    api: Toolkit.IAPI;
    session: string;
    html: string;
    update: Subject<{
        [key: string]: any;
    }>;
    _ng_columns: IColumnValue[];
    _ng_widths: {
        [key: number]: number;
    };
    private _subscriptions;
    private _guid;
    private _destroyed;
    private _inited;
    constructor(_cdRef: ChangeDetectorRef, _sanitizer: DomSanitizer);
    onClick(event: MouseEvent): void;
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    ngAfterContentInit(): void;
    _ng_getWidth(key: number): string;
    private _setColumns;
    private _onColumnsResized;
    private _onInputsUpdated;
    private _forceUpdate;
}
