import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabSourceDltFileModule } from '@tabs/sources/dltfile/module';
import { TabSourcePcapFileModule } from '@tabs/sources/pcapfile/module';
import { TabSourceDltStreamModule } from '@tabs/sources/dltstream/module';
import { TabSourceTextStreamModule } from '@tabs/sources/textstream/module';
import { TimezoneSelectorModule } from '@elements/timezones/module';
import { TabSourceMultipleFilesModule } from '@ui/tabs/sources/multiplefiles/module';
import { DialogsModule } from '@ui/views/dialogs/module';
import { SettingsModule } from '@ui/tabs/settings/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, TimezoneSelectorModule],
    declarations: [],
    exports: [
        TabSourceDltFileModule,
        TabSourcePcapFileModule,
        TabSourceDltStreamModule,
        TimezoneSelectorModule,
        TabSourceTextStreamModule,
        TabSourceMultipleFilesModule,
        SettingsModule,
    ],
    bootstrap: [
        TabSourceDltFileModule,
        TabSourcePcapFileModule,
        TabSourceDltStreamModule,
        TimezoneSelectorModule,
        TabSourceTextStreamModule,
        TabSourceMultipleFilesModule,
        DialogsModule,
        SettingsModule,
    ],
})
export class TabsModule {}
