import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { HiddenFilterModule } from '@elements/filter.hidden/module';

import { RecentParser } from './component';
import { RecentParserDlt } from './dlt/component';
import { RecentParserSomeIp } from './someip/component';

const components = [RecentParser, RecentParserDlt, RecentParserSomeIp];
@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        HiddenFilterModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class RecentParserModule {}
