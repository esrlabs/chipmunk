import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { IMulticastInfo } from '@elements/transport/setup/udp/state';

@Component({
    selector: 'app-transport-udp-multicast',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportUdpMulticast {
    @Input() public multicast!: IMulticastInfo;
    @Output() public clean: EventEmitter<void> = new EventEmitter();

    public _ng_onChanges() {
        if (
            this.multicast.fields.multiaddr.trim() !== '' ||
            (this.multicast.fields.interface !== undefined &&
                this.multicast.fields.interface.trim() !== '')
        ) {
            return;
        }
        this.clean.next();
    }

    public _ng_onRemove() {
        this.clean.next();
    }
}
export interface TransportUdpMulticast extends IlcInterface {}
