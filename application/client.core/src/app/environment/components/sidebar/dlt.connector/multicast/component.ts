// tslint:disable: member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, HostBinding, HostListener, AfterContentInit, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { DLTDeamonSettingsErrorStateMatcher, EDLTSettingsFieldAlias, EDLTSettingsErrorCodes } from '../state.error';

export interface IDLTDeamonMulticast {
    address: string;
    interface: string;
    state: {
        address: DLTDeamonSettingsErrorStateMatcher;
        interface: DLTDeamonSettingsErrorStateMatcher;
    };
}

@Component({
    selector: 'app-sidebar-app-dlt-connector-multicast',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppDLTConnectorMulticastComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    @Input() public multicast: IDLTDeamonMulticast;
    @Input() public clean: Subject<void>;
    @Input() public state: 'progress' | 'connected' | 'disconnected' = 'disconnected';

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngAfterContentInit() {
    }

    public ngAfterViewInit() {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onChanges() {
        if (this.multicast.address.trim() !== '' || this.multicast.interface.trim() !== '') {
            return;
        }
        this.clean.next();
    }

}
