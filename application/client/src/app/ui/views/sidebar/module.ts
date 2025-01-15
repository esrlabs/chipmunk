import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FiltersModule } from './search/module';
import { ObservedModule } from './observe/module';
import { AttachmentsModule } from './attachments/module';
import { CommentsModule } from './comments/module';
import { TeamWorkModule } from './teamwork/module';

@NgModule({
    imports: [
        CommonModule,
        FiltersModule,
        ObservedModule,
        AttachmentsModule,
        CommentsModule,
        TeamWorkModule,
    ],
    declarations: [],
    exports: [FiltersModule, ObservedModule, AttachmentsModule, CommentsModule, TeamWorkModule],
    bootstrap: [FiltersModule, ObservedModule, AttachmentsModule, CommentsModule, TeamWorkModule],
})
export class SidebarModule {}
