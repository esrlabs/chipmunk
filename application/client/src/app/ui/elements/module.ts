import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ContainersModule } from '@elements/containers/module';
import { ScrollAreaModule } from '@elements/scrollarea/module';
import { TabsModule } from '@elements/tabs/module';
import { RecentActionsModule } from '@elements/recent/module';
import { TreeModule } from '@elements/tree/module';
import { LocksHistoryModule } from '@elements/locks.history/module';
import { AutocompleteModule } from '@elements/autocomplete/module';
import { ComTooltipComponent } from '@elements/tooltip/component';
import { FolderInputModule } from '@elements/folderinput/module';
import { NavigatorModule } from '@elements/navigator/module';

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        ScrollAreaModule,
        TabsModule,
        RecentActionsModule,
        TreeModule,
        LocksHistoryModule,
        AutocompleteModule,
        FolderInputModule,
        NavigatorModule,
    ],
    declarations: [ComTooltipComponent],
    exports: [
        ContainersModule,
        ScrollAreaModule,
        TabsModule,
        RecentActionsModule,
        TreeModule,
        LocksHistoryModule,
        AutocompleteModule,
        FolderInputModule,
        NavigatorModule,
    ],
    bootstrap: [
        ContainersModule,
        ScrollAreaModule,
        TabsModule,
        RecentActionsModule,
        TreeModule,
        LocksHistoryModule,
        AutocompleteModule,
        FolderInputModule,
        NavigatorModule,
    ],
})
export class ElementsModule {}
