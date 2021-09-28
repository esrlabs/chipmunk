// tslint:disable:member-ordering

import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Session } from '../../../../controller/session/session';
import {
    NotificationsService,
    INotification,
} from '../../../../services.injectable/injectable.service.notifications';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../services/standalone/service.events.session';

@Component({
    selector: 'app-sidebar-app-notifications-counter',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppNotificationsCounterComponent
    implements OnDestroy, AfterContentInit, AfterViewInit
{
    @Input() public notification!: INotification;

    public _ng_count: number = 0;
    public _ng_session: string | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef, private _notifications: NotificationsService) {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.onNewNotification = this._notifications
            .getObservable()
            .new.subscribe(this._onNewNotification.bind(this));
        this._subscriptions.onNotificationsUpdated = this._notifications
            .getObservable()
            .updated.subscribe(this._onNotificationsUpdated.bind(this));
    }

    public ngAfterContentInit() {
        const session: Session | undefined = TabsSessionsService.getActive();
        if (session === undefined) {
            return;
        }
        this._ng_session = session.getGuid();
    }

    public ngAfterViewInit() {
        if (this._ng_session === undefined) {
            return;
        }
        this._ng_count = this._notifications.getNotReadCount(this._ng_session);
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _onNewNotification(notification: INotification) {
        if (this._ng_session === undefined) {
            return;
        }
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

    private _onSessionChange(session: Session | undefined) {
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
