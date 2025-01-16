import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AutocompleteModule } from '@elements/autocomplete/module';
import { ColorSelectorModule } from '@elements/color.selector/module';
import { ContainersModule } from '@elements/containers/module';
import { EditableModule } from '@elements/editable/module';
import { FilterInputModule } from '@elements/filter/module';
import { HiddenFilterModule } from '@elements/filter.hidden/module';
import { FolderInputModule } from '@elements/folderinput/module';
import { LocksHistoryModule } from '@elements/locks.history/module';
import { AttachSourceMenuModule } from '@elements/menu.attachsource/module';
import { NavigatorModule } from '@elements/navigator/module';
import { PairsModule } from '@elements/pairs/module';
import { RecentActionsModule } from '@elements/recent/module';
import { ScrollAreaModule } from '@elements/scrollarea/module';
import { TabsModule } from '@elements/tabs/module';
import { TeamworkAppletModule } from '@elements/teamwork/module';
import { TimezoneSelectorModule } from '@elements/timezones/module';
import { ComTooltipComponent } from '@elements/tooltip/component';
import { TreeModule } from '@elements/tree/module';

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
        TeamworkAppletModule,
        TimezoneSelectorModule,
        ColorSelectorModule,
        EditableModule,
        FilterInputModule,
        HiddenFilterModule,
        AttachSourceMenuModule,
        PairsModule,
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
        TeamworkAppletModule,
        TimezoneSelectorModule,
        ColorSelectorModule,
        EditableModule,
        FilterInputModule,
        HiddenFilterModule,
        AttachSourceMenuModule,
        PairsModule,
        ComTooltipComponent,
    ],
    bootstrap: [ComTooltipComponent],
})
export class ElementsModule {}
