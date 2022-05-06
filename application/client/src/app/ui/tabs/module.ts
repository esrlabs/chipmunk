import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabSourceDltFileModule } from '@tabs/sources/dltfile/module';
// import { TabAboutModule } from '@tabs/about/module';
// import { TabSettingsModule } from '@tabs/settings/module';
// import { TabReleaseNotesModule } from '@tabs/release.notes/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule],
    declarations: [],
    exports: [TabSourceDltFileModule],
})
export class TabsModule {
    constructor() {}
}
