import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FiltersModule } from './search/module';
import { ObservedModule } from './observe/module';
import { AttachmentsModule } from './attachments/module';
import { CommentsModule } from './comments/module';

@NgModule({
    imports: [CommonModule, FiltersModule, ObservedModule, AttachmentsModule, CommentsModule],
    declarations: [],
    exports: [FiltersModule],
})
export class SidebarModule {}
