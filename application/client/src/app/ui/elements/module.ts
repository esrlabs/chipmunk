import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ContainersModule } from '@elements/containers/module';
import { ScrollAreaModule } from '@elements/scrollarea/module';
import { TabsModule } from '@elements/tabs/module';
import { RecentActionsModule } from '@elements/recent/module';
import { RecentActionsMiniModule } from '@elements/recent.mini/module';
import { TreeModule } from '@elements/tree/module';
import { LocksHistoryModule } from '@elements/locks.history/module';
import { TransportReviewModule } from '@elements/transport/listed/module';
import { AutocompleteModule } from '@elements/autocomplete/module';
import { ComTooltipComponent } from '@elements/tooltip/component';

@NgModule({
    entryComponents: [ComTooltipComponent],
    imports: [
        CommonModule,
        ContainersModule,
        ScrollAreaModule,
        TabsModule,
        RecentActionsModule,
        RecentActionsMiniModule,
        TreeModule,
        LocksHistoryModule,
        TransportReviewModule,
        AutocompleteModule,
    ],
    declarations: [ComTooltipComponent],
    exports: [
        ContainersModule,
        ScrollAreaModule,
        TabsModule,
        RecentActionsModule,
        RecentActionsMiniModule,
        TreeModule,
        LocksHistoryModule,
        TransportReviewModule,
        AutocompleteModule,
    ],
})
export class ElementsModule {}
