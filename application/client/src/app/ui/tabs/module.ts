import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ObserveModule } from '@ui/tabs/observe/module';
import { TimezoneSelectorModule } from '@elements/timezones/module';
import { PairsModule } from '@elements/pairs/module';
import { MultipleFilesModule } from '@ui/tabs/multiplefiles/module';
import { DialogsModule } from '@ui/views/dialogs/module';
import { SettingsModule } from '@ui/tabs/settings/module';

@NgModule({
    imports: [CommonModule, TimezoneSelectorModule],
    declarations: [],
    exports: [
        ObserveModule,
        TimezoneSelectorModule,
        PairsModule,
        MultipleFilesModule,
        SettingsModule,
    ],
    bootstrap: [
        TimezoneSelectorModule,
        ObserveModule,
        PairsModule,
        MultipleFilesModule,
        DialogsModule,
        SettingsModule,
    ],
})
export class TabsModule {}
