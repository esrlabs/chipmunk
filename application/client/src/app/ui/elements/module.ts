import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ContainersModule } from '@elements/containers/module';
import { ScrollAreaModule } from '@elements/scrollarea/module';
import { TabsModule } from '@elements/tabs/module';
import { RecentActionsModule } from '@elements/recent/module';
import { TreeModule } from '@elements/tree/module';

import { ComTooltipComponent } from '@elements/tooltip/component';

@NgModule({
    entryComponents: [ComTooltipComponent],
    imports: [
        CommonModule,
        ContainersModule,
        ScrollAreaModule,
        TabsModule,
        RecentActionsModule,
        TreeModule,
    ],
    declarations: [ComTooltipComponent],
    exports: [ContainersModule, ScrollAreaModule, TabsModule, RecentActionsModule, TreeModule],
})
export class ElementsModule {}
