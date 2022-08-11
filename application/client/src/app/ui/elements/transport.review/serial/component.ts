import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DataSource } from '@platform/types/observe';
import { Session } from '@service/session/session';

@Component({
    selector: 'app-transport-serial-review',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportSerial extends ChangesDetector {
    @Input() public source!: DataSource;
    @Input() public session!: Session;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface TransportSerial extends IlcInterface {}
