import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RecentParser } from './component';
import { RecentParserDlt } from './dlt/component';
import { RecentParserSomeIp } from './someip/component';

@NgModule({
    imports: [CommonModule],
    declarations: [RecentParser, RecentParserDlt, RecentParserSomeIp],
    exports: [RecentParser],
})
export class RecentParserModule {}
