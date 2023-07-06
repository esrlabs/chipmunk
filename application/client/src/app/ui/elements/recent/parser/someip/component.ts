import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
// import { bytesToStr, timestampToUTC } from '@env/str';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-recent-parser-someip',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentParserSomeIp implements AfterContentInit {
    @Input() public parser!: $.Parser.SomeIp.Configuration;
    public fibex: string[] = [];

    public ngAfterContentInit(): void {
        if (this.parser.configuration.fibex_file_paths === undefined) {
            this.fibex = [];
        } else {
            this.fibex = this.parser.configuration.fibex_file_paths;
        }
    }
}
export interface RecentParserSomeIp extends IlcInterface {}
