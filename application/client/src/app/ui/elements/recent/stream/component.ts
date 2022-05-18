import { Component, AfterContentInit, Input, HostListener } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { bytesToStr, timestampToUTC } from '@env/str';
import { Recent as RecentFileAction } from '@service/recent/implementations/file/file';
import {
    IDLTOptions,
    StatisticInfo,
    LevelDistribution,
    EMTIN,
    IDLTFilters,
    getLogLevelName,
} from '@platform/types/parsers/dlt';
import { SourceDefinition } from '@platform/types/transport';

import * as Files from '@service/recent/implementations/file/index';

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

    @HostListener('click', [])
    onClick() {
        if (this.parser.dlt !== undefined) {
            this.ilc()
                .services.system.opener.stream()
                .dlt({ source: this.source, options: this.parser.dlt })
                .catch((err: Error) => {
                    this.log().error(`Fail to open stream; error: ${err.message}`);
                });
        }
    }
}
export interface RecentStream extends IlcInterface {}
