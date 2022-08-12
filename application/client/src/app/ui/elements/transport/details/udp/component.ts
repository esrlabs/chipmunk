import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { UDPTransportSettings } from '@platform/types/transport/udp';

@Component({
    selector: 'app-transport-udp-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportUdp extends ChangesDetector {
    @Input() public source!: UDPTransportSettings;
    @Input() public session!: Session;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface TransportUdp extends IlcInterface {}
