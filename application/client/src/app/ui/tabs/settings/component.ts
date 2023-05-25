import { Component, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';

@Component({
    selector: 'app-tabs-settings',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class Settings extends ChangesDetector implements AfterContentInit {
    public readonly state: State = new State();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.ilc()
            .services.system.settings.get()
            .then((entries) => {
                this.state.build(entries);
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get settings list: ${err}`);
            });
    }
}
export interface Settings extends IlcInterface {}
