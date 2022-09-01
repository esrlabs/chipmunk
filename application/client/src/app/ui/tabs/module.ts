import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabSourceDltFileModule } from '@tabs/sources/dltfile/module';
import { TabSourceDltStreamModule } from '@tabs/sources/dltstream/module';
import { TabSourceTextStreamModule } from '@tabs/sources/textstream/module';
import { TimezoneSelectorModule } from '@elements/timezones/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, TimezoneSelectorModule],
    declarations: [],
    exports: [
        TabSourceDltFileModule,
        TabSourceDltStreamModule,
        TimezoneSelectorModule,
        TabSourceTextStreamModule,
    ],
    bootstrap: [
        TabSourceDltFileModule,
        TabSourceDltStreamModule,
        TimezoneSelectorModule,
        TabSourceTextStreamModule,
    ],
})
export class TabsModule {}
