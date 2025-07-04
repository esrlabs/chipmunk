import { Component, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ObserveOperation } from '@service/session/dependencies/stream';

@Component({
    selector: 'app-recent-nature-icon',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class RecentIcon {
    @Input() public operation!: ObserveOperation;
}
export interface RecentIcon extends IlcInterface {}
