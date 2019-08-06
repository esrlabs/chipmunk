import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';
import HorizontalSidebarSessionsService, { CDefaultTabsGuids } from '../../../services/service.sessions.sidebar.horizontal';
import { NotificationsService, INotification } from '../../../services.injectable/injectable.service.notifications';

const DEFAULT_OPTIONS = {
    closeDelay: 4000,           // ms
    closingAnimationDelay: 1000 // ms
};

@Component({
    selector: 'app-notifications',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class NotificationsComponent implements OnDestroy {

    private _subscription: Subscription;

    public notifications: INotification[] = [];

    constructor(private _notificationsService: NotificationsService, private _cdRef: ChangeDetectorRef) {
        this._subscription = this._notificationsService.getObservable().subscribe(this._onNotification.bind(this));
    }

    public ngOnDestroy() {
        this._subscription.unsubscribe();
    }

    public onClose(notification: INotification) {
        this._close(notification.id);
    }

    private _onNotification(notification: INotification) {
        if (this.notifications.length > 5) {
            HorizontalSidebarSessionsService.setActive(CDefaultTabsGuids.notification);
            return;
        }
        notification = this._normalize(notification);
        if (notification === null) {
            return false;
        }
        this.notifications.push(notification);
        if (isFinite(notification.options.closeDelay)) {
            setTimeout(() => {
                this._close(notification.id);
            }, notification.options.closeDelay);
        }
        this._cdRef.detectChanges();
    }

    private _normalize(notification: INotification): INotification | null {
        if (typeof notification !== 'object' || notification === null) {
            return null;
        }
        if (typeof notification.caption !== 'string') {
            return null;
        }
        notification.id = typeof notification.id === 'string' ? (notification.id.trim() !== '' ? notification.id : Toolkit.guid()) : Toolkit.guid();
        notification.options = typeof notification.options === 'object' ? (notification.options !== null ? notification.options : {}) : {};
        notification.options.closeDelay = typeof notification.options.closeDelay === 'number' ? notification.options.closeDelay : DEFAULT_OPTIONS.closeDelay;
        notification.options.closable = typeof notification.options.closable === 'boolean' ? notification.options.closable : true;
        notification.buttons = notification.buttons instanceof Array ? notification.buttons : [];
        notification.buttons = notification.buttons.map((button) => {
            if (typeof button.caption !== 'string' || button.caption.trim() === '') {
                return null;
            }
            if (typeof button.handler !== 'function') {
                return null;
            }
            button.handler = this._onButtonClick.bind(this, notification.id, button.handler);
            return button;
        }).filter(button => button !== null);
        notification.closing = false;
        if (notification.progress === true) {
            notification.component = void 0;
            notification.message = void 0;
            return notification;
        }
        if (typeof notification.message === 'string' && notification.message.trim() !== '') {
            notification.component = void 0;
            notification.progress = void 0;
            return notification;
        }
        if (typeof notification.component === 'object' && notification.component !== null && notification.component.factory !== void 0) {
            notification.message = void 0;
            notification.progress = void 0;
            notification.component.inputs = typeof notification.component.inputs === 'object' ? (notification.component.inputs !== null ? notification.component.inputs : {}) : {};
            return notification;
        }
    }

    private _onButtonClick(id: string, handler: (...args: any[]) => any) {
        this._close(id);
        handler();
    }

    private _close(id: string) {
        this._update(id, { closing: true });
        setTimeout(this._remove.bind(this, id), DEFAULT_OPTIONS.closingAnimationDelay);
        this._cdRef.detectChanges();
    }

    private _remove(id: string) {
        this.notifications = this.notifications.filter(notification => notification.id !== id);
        this._cdRef.detectChanges();
    }

    private _update(id: string, updated: any): boolean {
        let index: number = -1;
        this.notifications.forEach((notify: INotification, i: number) => {
            if (index !== -1) {
                return;
            }
            if (notify.id === id) {
                index = i;
            }
        });
        if (index === -1) {
            return false;
        }
        Object.keys(updated).forEach((key: string) => {
            this.notifications[index][key] = updated[key];
        });
        return true;
    }

}
