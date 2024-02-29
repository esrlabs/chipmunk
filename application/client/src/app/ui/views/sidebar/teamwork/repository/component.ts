import { Component, Input, AfterContentInit, ChangeDetectionStrategy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { GitHubRepo } from '@platform/types/github';

@Component({
    selector: 'app-views-teamwork-repository',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Repository {
    @Input() repo!: GitHubRepo;
}
export interface Repository extends IlcInterface {}
