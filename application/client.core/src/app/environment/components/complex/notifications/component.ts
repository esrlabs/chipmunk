import { Component, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { Subscription } from 'rxjs';
import {
    NotificationsService,
    INotification,
    ENotificationType,
} from '../../../services.injectable/injectable.service.notifications';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { NotificationComponent } from './notification/component';

import * as Toolkit from 'chipmunk.client.toolkit';

const DEFAULT_OPTIONS = {
    closeDelay: 4000, // ms
    closingAnimationDelay: 1000, // ms
};

@Component({
    selector: 'app-notifications',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class NotificationsComponent implements OnDestroy {
    private _subscription: Subscription;

    constructor(
        private _notificationsService: NotificationsService,
        private _cdRef: ChangeDetectorRef,
        private _snackBar: MatSnackBar,
        private _zone: NgZone,
    ) {
        this._subscription = this._notificationsService
            .getObservable()
            .new.subscribe(this._onNotification.bind(this));
    }

    public ngOnDestroy() {
        this._subscription.unsubscribe();
    }

    private _onNotification(notification: INotification) {
        const valid_notification = this._normalize(notification);
        if (valid_notification === undefined) {
            return;
        }
        if (
            valid_notification.options !== undefined &&
            valid_notification.options.type === ENotificationType.info
        ) {
            return;
        }
        this._zone.run(() => {
            const ref: MatSnackBarRef<NotificationComponent> = this._snackBar.openFromComponent(
                NotificationComponent,
                {
                    duration:
                        valid_notification.options !== undefined
                            ? valid_notification.options.closeDelay
                            : 0,
                    horizontalPosition: 'center',
                    verticalPosition: 'bottom',
                    data: {
                        close: () => {
                            ref.dismiss();
                        },
                        getRef: (): MatSnackBarRef<NotificationComponent> => {
                            return ref;
                        },
                        notification: valid_notification,
                    },
                },
            );
            this._cdRef.detectChanges();
        });
    }

    private _normalize(notification: INotification): INotification | undefined {
        if (typeof notification !== 'object' || notification === null) {
            return undefined;
        }
        if (typeof notification.caption !== 'string') {
            return undefined;
        }
        notification.id =
            typeof notification.id === 'string'
                ? notification.id.trim() !== ''
                    ? notification.id
                    : Toolkit.guid()
                : Toolkit.guid();
        notification.options =
            typeof notification.options === 'object'
                ? notification.options !== null
                    ? notification.options
                    : {}
                : {};
        notification.options.closeDelay =
            typeof notification.options.closeDelay === 'number'
                ? notification.options.closeDelay
                : DEFAULT_OPTIONS.closeDelay;
        notification.options.closable =
            typeof notification.options.closable === 'boolean'
                ? notification.options.closable
                : true;
        notification.buttons = notification.buttons instanceof Array ? notification.buttons : [];
        notification.buttons = notification.buttons
            .map((button) => {
                if (typeof button.caption !== 'string' || button.caption.trim() === '') {
                    return null;
                }
                if (typeof button.handler !== 'function') {
                    return null;
                }
                return button;
            })
            .filter((button) => button !== null) as Toolkit.INotificationButton[];
        notification.closing = false;
        return notification;
    }
}
