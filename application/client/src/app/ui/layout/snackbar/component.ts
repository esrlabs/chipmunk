import { Component, AfterContentInit, NgZone } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { notifications } from '@ui/service/notifications';
import { Notification } from '@ui/service/notification/notification';
import { LayoutSnackBarMessage } from './message/component';

@Component({
    selector: 'app-layout-snackbar',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutSnackBar implements AfterContentInit {
    constructor(protected snackBar: MatSnackBar, protected zone: NgZone) {}

    ngAfterContentInit(): void {
        this.env().subscriber.register(
            notifications.subjects.get().pop.subscribe((notification: Notification) => {
                this.zone.run(() => {
                    const ref = this.snackBar.openFromComponent(LayoutSnackBarMessage, {
                        data: {
                            notification,
                            ref: () => ref,
                        },
                        duration: notification.duration(),
                    });
                });
            }),
        );
    }
}
export interface LayoutSnackBar extends IlcInterface {}
