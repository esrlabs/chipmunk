import { Component, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-recent-nature-icon',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentIcon {
    @Input() public observe!: $.Observe;

    public nature(): {
        File(): $.Origin.File.Configuration | undefined;
        Concat(): $.Origin.Concat.Configuration | undefined;
        Process(): $.Origin.Stream.Stream.Process.Configuration | undefined;
        Serial(): $.Origin.Stream.Stream.Serial.Configuration | undefined;
        TCP(): $.Origin.Stream.Stream.TCP.Configuration | undefined;
        UDP(): $.Origin.Stream.Stream.UDP.Configuration | undefined;
    } {
        const nature = this.observe.origin.nature();
        return {
            File: (): $.Origin.File.Configuration | undefined => {
                return nature instanceof $.Origin.File.Configuration ? nature : undefined;
            },
            Concat: (): $.Origin.Concat.Configuration | undefined => {
                return nature instanceof $.Origin.Concat.Configuration ? nature : undefined;
            },
            Process: (): $.Origin.Stream.Stream.Process.Configuration | undefined => {
                return nature instanceof $.Origin.Stream.Stream.Process.Configuration
                    ? nature
                    : undefined;
            },
            Serial: (): $.Origin.Stream.Stream.Serial.Configuration | undefined => {
                return nature instanceof $.Origin.Stream.Stream.Serial.Configuration
                    ? nature
                    : undefined;
            },
            TCP: (): $.Origin.Stream.Stream.TCP.Configuration | undefined => {
                return nature instanceof $.Origin.Stream.Stream.TCP.Configuration
                    ? nature
                    : undefined;
            },
            UDP: (): $.Origin.Stream.Stream.UDP.Configuration | undefined => {
                return nature instanceof $.Origin.Stream.Stream.UDP.Configuration
                    ? nature
                    : undefined;
            },
        };
    }

    public parser(): {
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
export interface RecentIcon extends IlcInterface {}
