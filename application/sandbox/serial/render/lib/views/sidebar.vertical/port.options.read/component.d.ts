import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { IOptions } from '../../../common/interface.options';
export declare class SidebarVerticalPortOptionsReadComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    options: IOptions;
    private _subscriptions;
    private _destroyed;
    _ng_options: Array<{
        key: string;
        value: string;
    }>;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    private _forceUpdate;
}
