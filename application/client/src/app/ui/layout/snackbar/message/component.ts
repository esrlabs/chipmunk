import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Action } from '@platform/types/notification/index';
import { Notification } from '@ui/service/notification/notification';

import * as Requests from '@platform/ipc/request';

@Component({
    selector: 'app-layout-snackbar-message',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class LayoutSnackBarMessage {
    constructor(
        @Inject(MAT_SNACK_BAR_DATA)
        public data: {
            notification: Notification;
            ref: () => MatSnackBarRef<LayoutSnackBarMessage>;
        },
    ) {}

    ngOnAction(action: Action): void {
        this.data.ref().dismiss();
        Requests.IpcRequest.send(
            Requests.Action.Call.Response,
            new Requests.Action.Call.Request({
                uuid: action.uuid,
                inputs: undefined,
            }),
        )
            .then((response) => {
                if (response.error !== undefined) {
                    this.log().error(
                        `Fail to proccess action ${action.name} (${action.uuid}); error: ${response.error}`,
                    );
                }
            })
            .catch((error: Error) => {
                this.log().error(
                    `Fail to send action ${action.name} (${action.uuid}); error: ${error.message}`,
                );
            });
    }

    ngDismiss() {
        this.data.ref().dismiss();
    }
}
export interface LayoutSnackBarMessage extends IlcInterface {}
