// tslint:disable:member-ordering

import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
    ViewEncapsulation,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
    NotificationsService,
    INotification,
} from '../../../../services.injectable/injectable.service.notifications';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EParent } from '../../../../services/standalone/service.output.redirections';

import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';

export interface INotificationData {
    notification: INotification;
    match: {
        caption: string;
        message: string;
    };
}

const CReadTimeout = 2000;

@Component({
    selector: 'app-sidebar-app-notification',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class SidebarAppNotificationComponent implements OnDestroy, AfterContentInit, AfterViewInit {
    @Input() public data!: INotificationData;
    @Input() public session!: string;

    public _ng_more: boolean = false;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _notifications: NotificationsService,
        private _sanitizer: DomSanitizer,
    ) {}

    public ngAfterContentInit() {}

    public ngAfterViewInit() {
        if (this.data.notification.read) {
            return;
        }
        const id: string | undefined = this.data.notification.id;
        setTimeout(() => {
            id !== undefined && this._notifications.setAsRead(this.session, id);
        }, CReadTimeout);
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_hasRef(): boolean {
        return this.data.notification.row !== undefined;
    }

    public _ng_hasActions(): boolean {
        return this.data.notification.buttons instanceof Array
            ? this.data.notification.buttons.length > 0
            : false;
    }

    public _ng_getSafeHTML(input: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(input);
    }

    public _ng_goToLink() {
        if (
            typeof this.data.notification.row !== 'number' ||
            isNaN(this.data.notification.row) ||
            !isFinite(this.data.notification.row)
        ) {
            return;
        }
        OutputRedirectionsService.select(EParent.notification, this.session, {
            output: this.data.notification.row,
        });
    }
}
