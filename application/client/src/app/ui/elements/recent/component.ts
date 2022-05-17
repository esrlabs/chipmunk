import { Component, AfterContentInit, Input, HostListener } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { bytesToStr, timestampToUTC } from '@env/str';
import { Action } from '@service/recent/action';

import * as Files from '@service/recent/implementations/file/index';

@Component({
    selector: 'app-recent-actions',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentActions implements AfterContentInit {
    public actions!: Action[];
    public error?: string;

    public ngAfterContentInit(): void {
        this.ilc()
            .services.system.recent.get()
            .then((actions: Action[]) => {
                this.actions = actions;
            })
            .catch((error: Error) => {
                this.error = error.message;
            });
    }
}
export interface RecentActions extends IlcInterface {}
