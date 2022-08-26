import { Component, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ProcessTransportSettings } from '@platform/types/transport/process';

@Component({
    selector: 'app-recent-stream-process',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class SourceProcess {
    @Input() public options!: ProcessTransportSettings;
}
export interface SourceProcess extends IlcInterface {}
