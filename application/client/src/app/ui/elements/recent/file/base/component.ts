import { Component, AfterContentInit, Input, HostListener } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';

@Component({
    selector: 'app-recent-file-base',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class RecentFileBase {
    @Input() public name!: string;
    @Input() public path!: string;
    @Input() public size!: string;
    @Input() public created!: string;
}
export interface RecentFileBase extends IlcInterface {}
