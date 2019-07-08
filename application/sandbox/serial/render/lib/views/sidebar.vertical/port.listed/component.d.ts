import { OnDestroy, ChangeDetectorRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { IPortInfo, IPortState } from '../../../common/interface.portinfo';
export declare class SidebarVerticalPortInfoComponent implements AfterViewInit, OnDestroy, OnChanges {
    private _cdRef;
    port: IPortInfo;
    state: IPortState;
    _ng_more: Array<{
        name: string;
        value: string;
    }>;
    _ng_read: string;
    private _subscriptions;
    private _destroyed;
    private _more;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    ngOnChanges(changes: SimpleChanges): void;
    _ng_isMoreOpened(): boolean;
    _ng_onMore(event: MouseEvent): void;
    private _updateSize;
    private _forceUpdate;
}
