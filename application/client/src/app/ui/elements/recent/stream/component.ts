import { Component, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { IDLTOptions } from '@platform/types/parsers/dlt';
import { SourceDefinition } from '@platform/types/transport';

@Component({
    selector: 'app-recent-stream',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentStream {
    @Input() public source!: SourceDefinition;
    @Input() public parser!: {
        dlt?: IDLTOptions;
    };
}
export interface RecentStream extends IlcInterface {}
