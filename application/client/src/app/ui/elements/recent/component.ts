import {
    Component,
    AfterContentInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Action } from '@service/recent/action';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-recent-actions',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class RecentActions extends ChangesDetector implements AfterContentInit {
    public actions!: Action[];
    public error?: string;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.ilc()
            .services.system.recent.get()
            .then((actions: Action[]) => {
                this.actions = actions;
                this.markChangesForCheck();
            })
            .catch((error: Error) => {
                this.error = error.message;
            });
    }
}
export interface RecentActions extends IlcInterface {}
