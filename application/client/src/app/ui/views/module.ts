import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceModule } from './workspace/module';
import { ToolbarModule } from './toolbar/module';
import { SidebarModule } from './sidebar/module';
import { DialogsModule } from './dialogs/module';

import { ScrollAreaModule } from '@elements/scrollarea/module';
import { ContainersModule } from '@elements/containers/module';

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        ScrollAreaModule,
        WorkspaceModule,
        ToolbarModule,
        SidebarModule,
        DialogsModule,
    ],
    declarations: [],
    exports: [ScrollAreaModule, WorkspaceModule, ToolbarModule, SidebarModule, DialogsModule],
    bootstrap: [ScrollAreaModule, WorkspaceModule, ToolbarModule, SidebarModule, DialogsModule]
})
export class ViewsModule {}
