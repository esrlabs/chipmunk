import { OnDestroy, ChangeDetectorRef, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { IPortInfo, IPortState } from '../../../common/interface.portinfo';
import { IOptions } from '../../../common/interface.options';
export declare class SidebarVerticalPortConnectedComponent implements AfterViewInit, OnDestroy, OnChanges {
    private _cdRef;
    port: IPortInfo;
    options: IOptions;
    state: IPortState;
    onDisconnect: () => void;
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
    _ng_onDisconnect(): void;
    private _updateSize;
    private _forceUpdate;
}
