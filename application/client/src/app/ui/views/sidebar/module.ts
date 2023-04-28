import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FiltersModule } from './search/module';
import { ObservedModule } from './observe/module';
import { AttachmentsModule } from './attachments/module';

@NgModule({
    imports: [CommonModule, FiltersModule, ObservedModule, AttachmentsModule],
    declarations: [],
    exports: [FiltersModule],
})
export class SidebarModule {}
