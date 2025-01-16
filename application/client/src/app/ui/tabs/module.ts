import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ObserveModule } from '@ui/tabs/observe/module';
import { MultipleFilesModule } from '@ui/tabs/multiplefiles/module';
import { DialogsModule } from '@ui/views/dialogs/module';
import { SettingsModule } from '@ui/tabs/settings/module';
import { ChangelogModule } from '@ui/tabs/changelogs/module';
import { HelpModule } from '@ui/tabs/help/module';

@NgModule({
    imports: [
        CommonModule,
        ObserveModule,
        MultipleFilesModule,
        SettingsModule,
        ChangelogModule,
        HelpModule,
    ],
    declarations: [],
    exports: [ObserveModule, MultipleFilesModule, SettingsModule, ChangelogModule, HelpModule],
    bootstrap: [],
})
export class TabsModule {}
