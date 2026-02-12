import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FiltersModule } from './search/module';
import { ObservedModule } from './observe/module';
import { AttachmentsModule } from './attachments/module';
import { CommentsModule } from './comments/module';
import { TeamWorkModule } from './teamwork/module';
import { ChatModule } from './chat/module';

@NgModule({
    imports: [
        CommonModule,
        FiltersModule,
        ObservedModule,
        AttachmentsModule,
        CommentsModule,
        TeamWorkModule,
        ChatModule,
    ],
    declarations: [],
    exports: [FiltersModule, ObservedModule, AttachmentsModule, CommentsModule, TeamWorkModule, ChatModule],
    bootstrap: [],
})
export class SidebarModule {}
