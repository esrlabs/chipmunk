import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
// import { bytesToStr, timestampToUTC } from '@env/str';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-recent-nature-concat',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentNatureConcat implements AfterContentInit {
    @Input() public origin!: $.Origin.Concat.Configuration;

    public name!: string;
    public path!: string;
    public size!: string;
    public created!: string;

    public ngAfterContentInit(): void {
        // this.name = base.name;
        // this.path = base.path;
        // this.size = bytesToStr(base.size);
        // this.created = timestampToUTC(base.created);
    }
}
export interface RecentNatureConcat extends IlcInterface {}
