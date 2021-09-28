import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabAboutModule } from './about/module';
import { TabPluginsModule } from './plugins/module';
import { TabSettingsModule } from './settings/module';
import { TabReleaseNotesModule } from './release.notes/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule],
    declarations: [],
    exports: [TabAboutModule, TabPluginsModule, TabSettingsModule, TabReleaseNotesModule],
})
export class EnvironmentTabsModule {
    constructor() {}
}
