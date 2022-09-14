import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { SerialTransportSettings } from '@platform/types/transport/serial';
import { ObserveOperation } from '@service/session/dependencies/observe/operation';

@Component({
    selector: 'app-transport-serial-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportSerial extends ChangesDetector {
    @Input() public observe!: ObserveOperation | undefined;
    @Input() public source!: SerialTransportSettings;
    @Input() public session!: Session;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface TransportSerial extends IlcInterface {}
