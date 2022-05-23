import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceModule } from './workspace/module';
import { ToolbarModule } from './toolbar/module';
import { SidebarModule } from './sidebar/module';

import { ScrollAreaModule } from '@elements/scrollarea/module';
import { ContainersModule } from '@elements/containers/module';

@NgModule({
    entryComponents: [],
    imports: [
        CommonModule,
        ContainersModule,
        ScrollAreaModule,
        WorkspaceModule,
        ToolbarModule,
        SidebarModule,
    ],
    declarations: [],
    exports: [ScrollAreaModule, WorkspaceModule, ToolbarModule, SidebarModule],
})
export class ViewsModule {
    constructor() {}
}
