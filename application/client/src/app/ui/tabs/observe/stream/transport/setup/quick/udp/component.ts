import { Component, ChangeDetectorRef, OnDestroy, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { SetupBase } from '../../bases/udp/component';

@Component({
    selector: 'app-udp-quicksetup',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class QuickSetup extends SetupBase implements OnDestroy, AfterContentInit {
    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public connect() {
        this.action.apply();
    }
}
export interface QuickSetup extends IlcInterface {}
