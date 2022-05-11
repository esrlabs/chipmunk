import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabSourceDltFileModule } from '@tabs/sources/dltfile/module';
import { TabSourceDltNetModule } from '@tabs/sources/dltnet/module';
import { TimezoneSelectorModule } from '@ui/elements/timezones/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, TimezoneSelectorModule],
    declarations: [],
    exports: [TabSourceDltFileModule, TabSourceDltNetModule, TimezoneSelectorModule],
})
export class TabsModule {
    constructor() {}
}
