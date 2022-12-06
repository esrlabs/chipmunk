import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { MulticastInfo } from '@platform/types/transport/udp';

@Component({
    selector: 'app-transport-udp-multicast',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportUdpMulticast {
    @Input() public multicast!: MulticastInfo;
    @Output() public clean: EventEmitter<void> = new EventEmitter();

    public onChange() {
        if (
            this.multicast.multiaddr.trim() !== '' ||
            (this.multicast.interface !== undefined && this.multicast.interface.trim() !== '')
        ) {
            return;
        }
        this.clean.next(undefined);
    }

    public _ng_onRemove() {
        this.clean.next();
    }
}
export interface TransportUdpMulticast extends IlcInterface {}
