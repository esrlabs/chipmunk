import { Component, ChangeDetectorRef, AfterContentInit, } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { SetupBase } from '../../bases/tcp/component';

@Component({
    selector: 'app-tcp-quicksetup',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class QuickSetup extends SetupBase implements AfterContentInit {

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public connect() {
        this.action.apply();
    }
}
export interface QuickSetup extends IlcInterface {}
