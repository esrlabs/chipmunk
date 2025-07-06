import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ObserveOperation } from '@service/session/dependencies/stream';

@Component({
    selector: 'app-recent-nature',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class RecentNature implements AfterContentInit {
    @Input() public operation!: ObserveOperation;

    public ngAfterContentInit(): void {
        //
    }
}
export interface RecentNature extends IlcInterface {}
