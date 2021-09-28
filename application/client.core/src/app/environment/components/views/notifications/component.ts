import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
    ViewContainerRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Session } from '../../../controller/session/session';
import { ControllerSessionScope } from '../../../controller/session/dependencies/scope/controller.session.tab.scope';
import {
    NotificationsService,
    INotification,
} from '../../../services.injectable/injectable.service.notifications';
import { ENotificationType } from 'chipmunk.client.toolkit';
import { sortPairs, IPair } from '../../../thirdparty/code/engine';
import { INotificationData } from './notification/component';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';

import ContextMenuService from '../../../services/standalone/service.contextmenu';
import EventsSessionService from '../../../services/standalone/service.events.session';
import TabsSessionsService from '../../../services/service.sessions.tabs';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IState {
    level: ENotificationType | undefined;
    filter: string;
}

interface ISummary {
    info: number;
    accent: number;
    warning: number;
    error: number;
}

const CLogLevels: { [key: string]: ENotificationType[] } = {
    [ENotificationType.info]: [
        ENotificationType.info,
        ENotificationType.accent,
        ENotificationType.warning,
        ENotificationType.error,
    ],
    [ENotificationType.accent]: [
        ENotificationType.accent,
        ENotificationType.warning,
        ENotificationType.error,
    ],
    [ENotificationType.warning]: [ENotificationType.warning, ENotificationType.error],
    [ENotificationType.error]: [ENotificationType.error],
};

const CStateKey = 'notifications-state-key';

@Component({
    selector: 'app-sidebar-app-notifications',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppNotificationsComponent
    implements OnDestroy, AfterContentInit, AfterViewInit
{
    public _ng_session: string | undefined = undefined;
    public _ng_notifications: INotificationData[] = [];
    public _ng_filter: string = '';
    public _ng_summary: ISummary = {
        info: 0,
        accent: 0,
        warning: 0,
        error: 0,
    };
    public _ng_selected: INotification | undefined;

    private _level: ENotificationType | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppNotificationsComponent');
    private _destroyed: boolean = false;

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _vcRef: ViewContainerRef,
        private _notifications: NotificationsService,
    ) {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.onNewNotification = this._notifications
            .getObservable()
            .new.subscribe(this._onNewNotification.bind(this));
        this._ng_onFilterChange = this._ng_onFilterChange.bind(this);
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._saveState();
    }

    public ngAfterContentInit() {
        const session: Session | undefined = TabsSessionsService.getActive();
        if (session === undefined) {
            return;
        }
        this._ng_session = session.getGuid();
        this._loadState();
    }

    public ngAfterViewInit() {}

    public _ng_contextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: 'Show All',
                handler: () => {
                    this._setLogLevel(undefined);
                },
            },
            {
                /* delimiter */
            },
            {
                caption: `Important`,
                handler: () => {
                    this._setLogLevel(ENotificationType.accent);
                },
            },
            {
                caption: `Warnings`,
                handler: () => {
                    this._setLogLevel(ENotificationType.warning);
                },
            },
            {
                caption: `Errors`,
                handler: () => {
                    this._setLogLevel(ENotificationType.error);
                },
            },
            {
                /* delimiter */
            },
            {
                caption: `Clear All`,
                handler: () => {
                    this._ng_onCleanup();
                },
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_onFilterChange() {
        this._ng_notifications = this._getNotifications();
        this._forceUpdate();
    }

    public _ng_onCleanup() {
        this._ng_notifications = [];
        this._ng_filter = '';
        this._ng_selected = undefined;
        this._ng_session !== undefined && this._notifications.clear(this._ng_session);
        this._ng_summary = this._getSummary();
        this._forceUpdate();
    }

    public _ng_select(notification: INotification) {
        if (this._ng_selected !== undefined && this._ng_selected.id === notification.id) {
            this._ng_selected = undefined;
        } else {
            this._ng_selected = notification;
        }
        this._forceUpdate();
    }

    public _ng_isSelected(notification: INotification): boolean {
        if (this._ng_selected === undefined) {
            return false;
        }
        return this._ng_selected.id === notification.id;
    }

    private _getNotifications(): INotificationData[] {
        if (this._ng_session === undefined) {
            return [];
        }
        const notifications: INotification[] | undefined = this._notifications.get(
            this._ng_session,
        );
        if (notifications === undefined) {
            return [];
        }
        if (this._ng_filter === '') {
            return this._filterLogLevel(
                notifications
                    .map((notification: INotification) => {
                        if (notification.message === undefined) {
                            return null;
                        }
                        return {
                            notification: notification,
                            match: {
                                caption: notification.caption,
                                message: notification.message,
                            },
                        };
                    })
                    .filter((n) => n !== null) as INotificationData[],
            );
        }
        const pairs: IPair[] = notifications
            .map((notification: INotification) => {
                if (notification.id === undefined) {
                    return null;
                }
                return {
                    id: notification.id,
                    caption: notification.caption,
                    description: notification.message,
                };
            })
            .filter((n) => n !== null) as IPair[];
        const scored = sortPairs(pairs, this._ng_filter, this._ng_filter !== '', 'span');
        const sorted: INotificationData[] = [];
        scored.forEach((s: IPair) => {
            const found: INotification | undefined = notifications.find((p) => p.id === s.id);
            if (found === undefined) {
                return;
            }
            sorted.push({
                notification: found,
                match: {
                    caption: s.tcaption === undefined ? s.caption : s.tcaption,
                    message: s.tdescription === undefined ? s.description : s.tdescription,
                },
            });
        });
        return this._filterLogLevel(sorted);
    }

    private _filterLogLevel(notifications: INotificationData[]): INotificationData[] {
        if (this._level === undefined || CLogLevels[this._level] === undefined) {
            return notifications;
        }
        return notifications.filter((data: INotificationData) => {
            if (this._level === undefined) {
                return false;
            }
            return CLogLevels[this._level].indexOf((data as any).notification.options.type) !== -1;
        });
    }

    private _loadState() {
        if (this._ng_session === undefined) {
            return;
        }
        const session: Session | Error = TabsSessionsService.getSessionController(this._ng_session);
        if (session instanceof Error) {
            return;
        }
        const scope: ControllerSessionScope = session.getScope();
        const state: IState | undefined = scope.get<IState>(CStateKey);
        if (state !== undefined) {
            this._ng_filter = state.filter;
            this._level = state.level;
        } else {
            this._ng_filter = '';
            this._level = undefined;
        }
        this._ng_notifications = this._getNotifications();
        this._ng_summary = this._getSummary();
        this._forceUpdate();
    }

    private _saveState() {
        if (this._ng_session === undefined) {
            return;
        }
        const session: Session | Error = TabsSessionsService.getSessionController(this._ng_session);
        if (session instanceof Error) {
            return;
        }
        const scope: ControllerSessionScope = session.getScope();
        scope.set<IState>(CStateKey, {
            filter: this._ng_filter,
            level: this._level,
        });
    }

    private _setLogLevel(value: ENotificationType | undefined) {
        this._level = value;
        this._ng_notifications = this._getNotifications();
        this._forceUpdate();
    }

    private _onNewNotification(notification: INotification) {
        if (notification.session !== undefined && notification.session !== this._ng_session) {
            return;
        }
        this._ng_notifications = this._getNotifications();
        this._ng_summary = this._getSummary();
        this._forceUpdate();
    }

    private _onSessionChange(session: Session | undefined) {
        this._saveState();
        if (session === undefined) {
            this._ng_session = undefined;
            this._ng_filter = '';
            this._level = undefined;
            this._ng_notifications = [];
            this._ng_selected = undefined;
            this._forceUpdate();
            return;
        }
        this._ng_session = session.getGuid();
        this._loadState();
    }

    private _getSummary(): ISummary {
        const summary: ISummary = {
            info: 0,
            accent: 0,
            warning: 0,
            error: 0,
        };
        if (this._ng_session === undefined) {
            return summary;
        }
        const notifications: INotification[] = this._notifications.get(this._ng_session);
        notifications.forEach((notification: INotification) => {
            if (notification.options === undefined) {
                return;
            }
            summary.info += notification.options.type === ENotificationType.info ? 1 : 0;
            summary.accent += notification.options.type === ENotificationType.accent ? 1 : 0;
            summary.warning += notification.options.type === ENotificationType.warning ? 1 : 0;
            summary.error += notification.options.type === ENotificationType.error ? 1 : 0;
        });
        return summary;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
