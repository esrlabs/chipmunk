import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, AfterViewInit, ViewContainerRef } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription } from 'rxjs';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { ControllerSessionScope } from '../../../controller/controller.session.tab.scope';
import { NotificationsService, INotification } from '../../../services.injectable/injectable.service.notifications';

interface ILogLevelListItem {
    value: string;
    caption: string;
}

interface IState {
    level: string;
    filter: string;
}

const CStateKey = 'notifications-state-key';

@Component({
    selector: 'app-sidebar-app-notifications',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppNotificationsComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    public _ng_session: string | undefined = undefined;
    public _ng_notifications: INotification[] = [];
    public _ng_levels: ILogLevelListItem[] = [
        { value: 'all', caption: 'All' },
        { value: 'error', caption: 'Errors' },
        { value: 'warning', caption: 'Warnings' },
        { value: 'info', caption: 'Info' },
    ];
    public _ng_level: string = 'all';
    public _ng_filter: string = '';

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppNotificationsComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef,
                private _notifications: NotificationsService) {
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onNewNotification = this._notifications.getObservable().new.subscribe(this._onNewNotification.bind(this));
        this._ng_onFilterChange = this._ng_onFilterChange.bind(this);
        this._ng_onLevelChange = this._ng_onLevelChange.bind(this);
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._saveState();
    }

    public ngAfterContentInit() {
        const session: ControllerSessionTab | undefined = TabsSessionsService.getActive();
        if (session === undefined) {
            return;
        }
        this._ng_session = session.getGuid();
        this._loadState();
    }

    public ngAfterViewInit() {

    }

    public _ng_onFilterChange(value: string) {
        this._ng_filter = value;
        this._ng_notifications = this._getNotifications();
        this._forceUpdate();
    }

    public _ng_onLevelChange(value: string) {
        this._ng_level = value;
        this._ng_notifications = this._getNotifications();
        this._forceUpdate();
    }

    public _ng_onCleanup() {
        this._ng_notifications = [];
        this._notifications.clear(this._ng_session);
        this._forceUpdate();
    }

    private _loadState() {
        if (this._ng_session === undefined) {
            return;
        }
        const session: ControllerSessionTab | Error = TabsSessionsService.getSessionController(this._ng_session);
        if (session instanceof Error) {
            return;
        }
        const scope: ControllerSessionScope = session.getScope();
        const state: IState | undefined = scope.get<IState>(CStateKey);
        if (state !== undefined) {
            this._ng_filter = state.filter;
            this._ng_level = state.level;
        } else {
            this._ng_filter = '';
            this._ng_level = 'all';
        }
        this._ng_notifications = this._getNotifications();
        this._forceUpdate();
    }

    private _saveState() {
        if (this._ng_session === undefined) {
            return;
        }
        const session: ControllerSessionTab | Error = TabsSessionsService.getSessionController(this._ng_session);
        if (session instanceof Error) {
            return;
        }
        const scope: ControllerSessionScope = session.getScope();
        scope.set<IState>(CStateKey, {
            filter: this._ng_filter,
            level: this._ng_level
        });
    }

    private _onNewNotification(notification: INotification) {
        if (notification.session !== undefined && notification.session !== this._ng_session) {
            return;
        }
        this._ng_notifications = this._getNotifications();
        this._forceUpdate();
    }

    private _onSessionChange(session: ControllerSessionTab | undefined) {
        this._saveState();
        if (session === undefined) {
            this._ng_session = undefined;
            this._ng_filter = '';
            this._ng_level = 'all';
            this._ng_notifications = [];
            this._forceUpdate();
            return;
        }
        this._ng_session = session.getGuid();
        this._loadState();
    }

    private _getNotifications(): INotification[] {
        let notifications: INotification[] = this._notifications.get(this._ng_session);
        if (this._ng_filter.trim() !== '') {
            const regex: RegExp | Error = Toolkit.regTools.createFromStr(this._ng_filter);
            if (!(regex instanceof Error)) {
                notifications = notifications.filter((notification: INotification) => {
                    return `${notification.caption}-#@#-${notification.message}`.search(regex) !== -1;
                });
            }
        }
        if (this._ng_level !== 'all') {
            notifications = notifications.filter((notification: INotification) => {
                if (notification.options === undefined) {
                    return false;
                }
                return notification.options.type === this._ng_level;
            });
        }
        return notifications;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
