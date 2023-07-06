import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { getFileName, getParentFolder } from '@platform/types/files';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-recent-nature-file',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentNatureFile implements AfterContentInit {
    @Input() public origin!: $.Origin.File.Configuration;

    public name!: string;
    public path!: string;

    public ngAfterContentInit(): void {
        this.name = getFileName(this.origin.filename());
        this.path = getParentFolder(this.origin.filename());
    }
}
export interface RecentNatureFile extends IlcInterface {}
