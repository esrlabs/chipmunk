// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { NotificationsService, INotification } from '../../../../services.injectable/injectable.service.notifications';
import TabsSessionsService from '../../../../services/service.sessions.tabs';

@Component({
    selector: 'app-sidebar-app-notifications-counter',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppNotificationsCounterComponent implements OnDestroy, AfterContentInit, AfterViewInit {


    @Input() public notification: INotification;

    public _ng_count: number = 0;
    public _ng_session: string;

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef, private _notifications: NotificationsService) {
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onNewNotification = this._notifications.getObservable().new.subscribe(this._onNewNotification.bind(this));
        this._subscriptions.onNotificationsUpdated = this._notifications.getObservable().updated.subscribe(this._onNotificationsUpdated.bind(this));
    }

    public ngAfterContentInit() {
        const session: ControllerSessionTab | undefined = TabsSessionsService.getActive();
        if (session === undefined) {
            return;
        }
        this._ng_session = session.getGuid();
    }

    public ngAfterViewInit() {

    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _onNewNotification(notification: INotification) {
        this._ng_count = this._notifications.getNotReadCount(this._ng_session);
        this._cdRef.detectChanges();
    }

    private _onNotificationsUpdated(session: string) {
        if (this._ng_session !== session) {
            return;
        }
        this._ng_count = this._notifications.getNotReadCount(this._ng_session);
        this._cdRef.detectChanges();
    }

    private _onSessionChange(session: ControllerSessionTab | undefined) {
        if (session === undefined) {
            this._ng_session = undefined;
            this._ng_count = 0;
            return;
        } else {
            this._ng_session = session.getGuid();
            this._ng_count = this._notifications.getNotReadCount(this._ng_session);
        }
        this._cdRef.detectChanges();
    }

}
