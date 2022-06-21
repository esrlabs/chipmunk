import { Component, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { UDPTransportSettings } from '@platform/types/transport/udp';

@Component({
    selector: 'app-recent-stream-udp',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class SourceUdp {
    @Input() public options!: UDPTransportSettings;
}
export interface SourceUdp extends IlcInterface {}
