import { Component, Input } from '@angular/core';

import { INotification } from '../../../../services/service.notifications';

@Component({
    selector: 'app-notification',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class NotificationComponent {

    @Input() public notification: INotification = { caption: '', message: '' };
    @Input() public onClose: (...args: any[]) => any = () => {};

}
