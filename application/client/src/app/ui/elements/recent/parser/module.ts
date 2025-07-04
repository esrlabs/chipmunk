import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RecentParser } from './component';

@NgModule({
    imports: [CommonModule],
    declarations: [RecentParser],
    exports: [RecentParser],
})
export class RecentParserModule {}
