import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginDesc } from '../desc';
import { Provider } from '../provider';

@Component({
    selector: 'app-plugins-manager-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class Details extends ChangesDetector {
    @Input() public provider!: Provider;
    @Input() public plugin!: PluginDesc;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}

export interface Details extends IlcInterface {}
