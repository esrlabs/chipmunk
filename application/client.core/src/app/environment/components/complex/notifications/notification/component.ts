import { Component, Input, Inject } from '@angular/core';
import { INotification } from '../../../../services.injectable/injectable.service.notifications';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';

export interface INotificationData {
    close: () => void;
    getRef: () => MatSnackBarRef<any>;
    notification: INotification;
}

const CLengthLimit = 255;

@Component({
    selector: 'app-notification',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class NotificationComponent {
    constructor(@Inject(MAT_SNACK_BAR_DATA) public data: INotificationData) {}

    public _ng_getMessage() {
        if (this.data.notification.message === undefined) {
            return '';
        }
        if (this.data.notification.message.length > CLengthLimit) {
            return this.data.notification.message.substr(0, CLengthLimit) + '...';
        } else {
            return this.data.notification.message;
        }
    }

    public _ng_close() {
        this.data.close();
    }
}
