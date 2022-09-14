import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { TCPTransportSettings } from '@platform/types/transport/tcp';
import { ObserveOperation } from '@service/session/dependencies/observe/operation';

@Component({
    selector: 'app-transport-tcp-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportTcp extends ChangesDetector {
    @Input() public observe!: ObserveOperation | undefined;
    @Input() public source!: TCPTransportSettings;
    @Input() public session!: Session;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface TransportTcp extends IlcInterface {}
