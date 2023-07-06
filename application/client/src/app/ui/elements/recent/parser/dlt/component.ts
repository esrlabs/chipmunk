import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
// import { bytesToStr, timestampToUTC } from '@env/str';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-recent-parser-dlt',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentParserDlt implements AfterContentInit {
    @Input() public parser!: $.Parser.Dlt.Configuration;

    public logLevel!: string;
    public fibex: string[] = [];

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
    }

    // public getTimezone(): string {
    //     return this.options.tz === undefined ? 'UTC' : this.options.tz;
    // }
}
export interface RecentParserDlt extends IlcInterface {}
