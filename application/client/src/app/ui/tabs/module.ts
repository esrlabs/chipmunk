import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ObserveModule } from '@ui/tabs/observe/module';
import { MultipleFilesModule } from '@ui/tabs/multiplefiles/module';
import { SettingsModule } from '@ui/tabs/settings/module';
import { ChangelogModule } from '@ui/tabs/changelogs/module';
import { HelpModule } from '@ui/tabs/help/module';
import { PluginsManagerModule } from '@ui/tabs/plugins/module';
import { SetupModule } from '@ui/tabs/setup/module';

@NgModule({
    imports: [
        CommonModule,
        ObserveModule,
        MultipleFilesModule,
        SettingsModule,
        ChangelogModule,
        HelpModule,
        PluginsManagerModule,
        SetupModule,
    ],
    declarations: [],
    exports: [ObserveModule, MultipleFilesModule, SettingsModule, ChangelogModule, HelpModule],
    bootstrap: [],
})
export class TabsModule {}
