import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { IMulticastInfo } from '@elements/transport/setup/states/udp';

@Component({
    selector: 'app-transport-udp-multicast',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Multicast {
    @Input() public multicast!: IMulticastInfo;
    @Output() public clean: EventEmitter<void> = new EventEmitter();

    public onChanges() {
        if (
            this.multicast.fields.multiaddr.trim() !== '' ||
            (this.multicast.fields.interface !== undefined &&
                this.multicast.fields.interface.trim() !== '')
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
