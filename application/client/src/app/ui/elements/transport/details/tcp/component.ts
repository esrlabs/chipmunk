import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { TCPTransportSettings } from '@platform/types/transport/tcp';
import { ObserveOperation } from '@service/session/dependencies/observe/operation';
import { DataSource } from '@platform/types/observe';

@Component({
    selector: 'app-transport-tcp-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportTcp extends ChangesDetector implements AfterContentInit {
    @Input() public observe!: ObserveOperation | undefined;
    @Input() public source!: DataSource;
    @Input() public session!: Session;

    public tcp!: TCPTransportSettings;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const stream = this.source.asStream();
        if (stream === undefined) {
            throw new Error(`DataSource isn't bound to stream`);
        }
        const tcp = stream.tcp();
        if (tcp === undefined) {
            throw new Error(`DataSource isn't bound to TCP stream`);
        }
        this.tcp = tcp;
    }
}
export interface TransportTcp extends IlcInterface {}
