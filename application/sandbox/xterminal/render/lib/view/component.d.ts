import { OnDestroy, ChangeDetectorRef, AfterViewInit, ElementRef } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
export declare class SidebarViewComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    _ng_xtermholder: ElementRef;
    api: Toolkit.IAPI;
    session: string;
    private _subscription;
    private _xterm;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    private _createXTerm;
    private _setTheme;
    private _onIncomeMessage;
    private _onIncomeEvent;
}
