import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { SerialTransportSettings } from '@platform/types/transport/serial';

@Component({
    selector: 'app-transport-serial-review',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportSerial extends ChangesDetector {
    @Input() public source!: SerialTransportSettings;
    @Input() public session!: Session;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface TransportSerial extends IlcInterface {}
