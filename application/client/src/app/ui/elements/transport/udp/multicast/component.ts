// tslint:disable: member-ordering

import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
    Output,
    EventEmitter,
} from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import * as Errors from '../error';
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

    public errors = {
        multiaddr: new Errors.ErrorState(Errors.Field.multicastAddress),
        interface: new Errors.ErrorState(Errors.Field.multicastInterface),
    };

    public _ng_onChanges() {
        if (
            this.multicast.multiaddr.trim() !== '' ||
            (this.multicast.interface !== undefined && this.multicast.interface.trim() !== '')
        ) {
            return;
        }
        this.clean.next();
    }
}
export interface TransportUdpMulticast extends IlcInterface {}
