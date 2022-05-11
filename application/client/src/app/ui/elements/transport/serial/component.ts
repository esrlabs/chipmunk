import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';

@Component({
    selector: 'app-transport-serial',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportSerial extends ChangesDetector {
    @Input() public state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface TransportSerial extends IlcInterface {}
