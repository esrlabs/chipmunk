import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RecentParser } from './component';
import { RecentParserDlt } from './dlt/component';
import { RecentParserSomeIp } from './someip/component';

const components = [RecentParser, RecentParserDlt, RecentParserSomeIp];
@NgModule({
    imports: [CommonModule],
    declarations: [...components],
    exports: [...components],
})
export class RecentParserModule {}
