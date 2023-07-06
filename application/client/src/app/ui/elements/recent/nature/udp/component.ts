import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-recent-nature-udp',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentNatureUdp implements AfterContentInit {
    @Input() public origin!: $.Origin.Stream.Stream.UDP.Configuration;

    public ngAfterContentInit(): void {
        //
    }
}
export interface RecentNatureUdp extends IlcInterface {}
