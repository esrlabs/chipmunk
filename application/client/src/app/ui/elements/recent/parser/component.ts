import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-recent-parser',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentParser implements AfterContentInit {
    @Input() public observe!: $.Observe;

    public ngAfterContentInit(): void {
        //
    }

    public as(): {
        Dlt(): $.Parser.Dlt.Configuration | undefined;
        SomeIp(): $.Parser.SomeIp.Configuration | undefined;
        Text(): $.Parser.Text.Configuration | undefined;
    } {
        return {
            Dlt: (): $.Parser.Dlt.Configuration | undefined => {
                return this.observe.parser.as<$.Parser.Dlt.Configuration>(
                    $.Parser.Dlt.Configuration,
                );
            },
            SomeIp: (): $.Parser.SomeIp.Configuration | undefined => {
                return this.observe.parser.as<$.Parser.SomeIp.Configuration>(
                    $.Parser.SomeIp.Configuration,
                );
            },
            Text: (): $.Parser.Text.Configuration | undefined => {
                return this.observe.parser.as<$.Parser.Text.Configuration>(
                    $.Parser.Text.Configuration,
                );
            },
        };
    }
}
export interface RecentParser extends IlcInterface {}
