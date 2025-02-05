import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
// import { bytesToStr, timestampToUTC } from '@env/str';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-recent-parser-dlt',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class RecentParserDlt implements AfterContentInit {
    @Input() public parser!: $.Parser.Dlt.Configuration;

    public logLevel!: string;
    public fibex: string[] = [];
    public timezone: string | undefined;

    public ngAfterContentInit(): void {
        if (
            this.parser.configuration.filter_config === undefined ||
            this.parser.configuration.filter_config.min_log_level === undefined
        ) {
            this.logLevel = $.Parser.Dlt.DltLogLevelNames[6];
        } else {
            this.logLevel = $.Parser.Dlt.getLogLevelName(
                this.parser.configuration.filter_config.min_log_level,
            );
        }
        if (this.parser.configuration.fibex_file_paths === undefined) {
            this.fibex = [];
        } else {
            this.fibex = this.parser.configuration.fibex_file_paths;
        }
        this.timezone = this.parser.configuration.tz;
    }
}
export interface RecentParserDlt extends IlcInterface {}
