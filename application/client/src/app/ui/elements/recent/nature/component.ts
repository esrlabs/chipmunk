import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-recent-nature',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentNature implements AfterContentInit {
    @Input() public observe!: $.Observe;

    public ngAfterContentInit(): void {
        //
    }

    public as(): {
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
}
export interface RecentNature extends IlcInterface {}
