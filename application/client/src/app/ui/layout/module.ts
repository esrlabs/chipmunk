import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { AppDirectiviesModule } from '@directives/module';
import { ElementsModule } from '@elements/module';
import { RecentActionsModule } from '@elements/recent/module';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';

import { Layout } from './component';
import { LayoutStatusBar } from './statusbar/component';
import { LayoutFocus } from './focus/component';
import { LayoutContextMenu } from './contextmenu/component';
import { LayoutSidebar } from './sidebar/component';
import { LayoutSidebarCaption } from './sidebar/caption/component';
import { LayoutSidebarControls } from './sidebar/controls/component';
import { LayoutWorkspace } from './workspace/component';
import { LayoutWorkspaceControls } from './workspace/controls/component';
import { LayoutWorkspaceNoContent } from './workspace/no-tabs-content/component';
import { LayoutToolbar } from './toolbar/component';
import { LayoutToolbarControls } from './toolbar/controls/component';
import { LayoutBottomSheet } from './bottomsheet/component';
import { OverlayModule } from '@angular/cdk/overlay';
import { JobsModule } from '@views/statusbar/jobs/module';
import { SessionModule } from '@views/statusbar/session/module';

// import { AppsBarStatusModule } from '../statusbar/module';

const entryComponents = [
    Layout,
    LayoutStatusBar,
    LayoutFocus,
    LayoutContextMenu,
    LayoutSidebar,
    LayoutSidebarCaption,
    LayoutSidebarControls,
    LayoutWorkspace,
    LayoutWorkspaceControls,
    LayoutWorkspaceNoContent,
    LayoutToolbar,
    LayoutToolbarControls,
    LayoutBottomSheet,
];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
        CommonModule,
        ContainersModule,
        AppDirectiviesModule,
        ElementsModule,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatBottomSheetModule,
        JobsModule,
        SessionModule,
        RecentActionsModule,
        OverlayModule,
    ],
    declarations: [...entryComponents],
    exports: [...entryComponents, AppDirectiviesModule],
})
export class LayoutModule {}
