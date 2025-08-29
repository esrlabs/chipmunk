/**
 * Declares the `views` module, which organizes UI components (views) by their rendering context.
 *
 * @remarks
 * This module serves as a central entry point for registering and managing views
 * that are rendered in various predefined UI zones of the application. Views are
 * grouped according to their logical container to ensure consistency, clarity,
 * and maintainability.
 *
 * The main rendering contexts include:
 * - `/toolbar` - all views rendered in the toolbar area.
 * - `/sidebar` - all views rendered in the sidebar panel.
 * - `/workspace` - all views rendered in the main output or content window.
 * - `/statusbar` - all views rendered in the bottom status bar.
 * - `/dialogs` - all views rendered in modal dialog windows.
 *
 * @important
 * When creating new views, developers must assign them to the appropriate context directory
 * based on the parent view or rendering zone. This promotes a clean separation of concerns
 * and simplifies view lifecycle and rendering logic across the application.
 *
 * @module
 * @public
 */

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
