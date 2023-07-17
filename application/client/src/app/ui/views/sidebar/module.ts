import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FiltersModule } from './search/module';
import { ObservedModule } from './observe/module';
import { AttachmentsModule } from './attachments/module';
import { SettingsModule } from './settings/modules';

@NgModule({
    imports: [CommonModule, FiltersModule, ObservedModule, AttachmentsModule, SettingsModule],
    declarations: [],
    exports: [FiltersModule],
})
export class SidebarModule {}
