import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceModule } from './workspace/module';
import { ToolbarModule } from './toolbar/module';
import { ScrollAreaModule } from '@elements/scrollarea/module';
import { ContainersModule } from '@elements/containers/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, ContainersModule, ScrollAreaModule, WorkspaceModule, ToolbarModule],
    declarations: [],
    exports: [ScrollAreaModule, WorkspaceModule, ToolbarModule],
})
export class ViewsModule {
    constructor() {}
}
