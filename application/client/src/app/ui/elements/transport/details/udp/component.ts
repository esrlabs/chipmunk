import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { UDPTransportSettings } from '@platform/types/transport/udp';
import { ObserveOperation } from '@service/session/dependencies/observing/operation';
import { DataSource } from '@platform/types/observe';

@Component({
    selector: 'app-transport-udp-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportUdp extends ChangesDetector implements AfterContentInit {
    @Input() public observe!: ObserveOperation | undefined;
    @Input() public source!: DataSource;
    @Input() public session!: Session;

    public udp!: UDPTransportSettings;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const stream = this.source.asStream();
        if (stream === undefined) {
            throw new Error(`DataSource isn't bound to stream`);
        }
        const udp = stream.udp();
        if (udp === undefined) {
            throw new Error(`DataSource isn't bound to UDP stream`);
        }
        this.udp = udp;
    }
}
export interface TransportUdp extends IlcInterface {}
