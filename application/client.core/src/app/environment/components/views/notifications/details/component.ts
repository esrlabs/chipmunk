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
import {
    NotificationsService,
    INotification,
} from '../../../../services.injectable/injectable.service.notifications';

@Component({
    selector: 'app-sidebar-app-notification-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppNotificationDetailsComponent
    implements OnDestroy, AfterContentInit, AfterViewInit
{
    @Input() public notification!: INotification;
    @Input() public session!: string;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _notifications: NotificationsService) {}

    public ngAfterContentInit() {}

    public ngAfterViewInit() {
        this.notification.id !== undefined &&
            this._notifications.setAsRead(this.session, this.notification.id);
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onButtonClick(handler: () => void) {
        handler();
    }
}
