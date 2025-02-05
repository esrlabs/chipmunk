import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceModule } from './workspace/module';
import { ToolbarModule } from './toolbar/module';
import { SidebarModule } from './sidebar/module';
import { DialogsModule } from './dialogs/module';

@NgModule({
    imports: [CommonModule, WorkspaceModule, ToolbarModule, SidebarModule, DialogsModule],
    declarations: [],
    exports: [WorkspaceModule, ToolbarModule, SidebarModule, DialogsModule],
    bootstrap: [],
})
export class ViewsModule {}
