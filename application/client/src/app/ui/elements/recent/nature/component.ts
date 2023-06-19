import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-recent-nature',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentNature implements AfterContentInit {
    @Input() public observe!: $.Observe;

    public ngAfterContentInit(): void {
        //
    }
}
export interface RecentNature extends IlcInterface {}
