import { Component, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { GitHubRepo } from '@platform/types/github';

@Component({
    selector: 'app-views-teamwork-repository',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Ilc()
export class Repository {
    @Input() repo!: GitHubRepo | undefined;
}
export interface Repository extends IlcInterface {}
