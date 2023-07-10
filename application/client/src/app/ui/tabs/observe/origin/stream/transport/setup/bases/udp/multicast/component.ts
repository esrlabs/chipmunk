import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import * as Errors from '../error';

import * as Stream from '@platform/types/observe/origin/stream/index';

@Component({
    selector: 'app-transport-udp-multicast',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Multicast {
    @Input() public multicast!: Stream.UDP.Multicast;

    public errors: {
        multiaddr: Errors.ErrorState;
        interface: Errors.ErrorState;
    } = {
        multiaddr: new Errors.ErrorState(Errors.Field.multicastAddress, () => {
            // this.update();
        }),
        interface: new Errors.ErrorState(Errors.Field.multicastAddress, () => {
            // this.update();
        }),
    };
    @Output() public clean: EventEmitter<void> = new EventEmitter();

    public onChanges() {
        if (
            this.multicast.multiaddr.trim() !== '' ||
            (this.multicast.interface !== undefined && this.multicast.interface.trim() !== '')
        ) {
            return;
        }
        this.clean.next();
    }

    public onRemove() {
        this.clean.next();
    }
}
export interface Multicast extends IlcInterface {}
