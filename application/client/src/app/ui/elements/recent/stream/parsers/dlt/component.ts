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
    selector: 'app-recent-stream-dlt',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class DLTStream {
    @Input() public options!: IDLTOptions;

    public getLogLevelName(level: number): string {
        return getLogLevelName(level);
    }

    public getTimezone(): string {
        return this.options.tz === undefined ? 'UTC' : this.options.tz;
    }
}
export interface DLTStream extends IlcInterface {}
