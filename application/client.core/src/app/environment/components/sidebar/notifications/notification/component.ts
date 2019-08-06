// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { INotification } from '../../../../services.injectable/injectable.service.notifications';

@Component({
    selector: 'app-sidebar-app-notification',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppNotificationComponent implements OnDestroy, AfterContentInit, AfterViewInit {


    @Input() public notification: INotification;

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    public ngAfterContentInit() {

    }

    public ngAfterViewInit() {

    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }


}
