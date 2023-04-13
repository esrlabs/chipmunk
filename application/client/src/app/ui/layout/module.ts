import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { AppDirectiviesModule } from '@directives/module';
import { ElementsModule } from '@elements/module';
import { RecentActionsModule } from '@elements/recent/module';
import { LayoutHomeModule } from './workspace/no-tabs-content/module';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import { Layout } from './component';
import { LayoutStatusBar } from './statusbar/component';
import { LayoutFocus } from './focus/component';
import { LayoutContextMenu } from './contextmenu/component';
import { LayoutSidebar } from './sidebar/component';
import { LayoutSidebarCaption } from './sidebar/caption/component';
import { LayoutSidebarControls } from './sidebar/controls/component';
import { LayoutWorkspace } from './workspace/component';
import { LayoutWorkspaceControls } from './workspace/controls/component';
import { LayoutToolbar } from './toolbar/component';
import { LayoutToolbarControls } from './toolbar/controls/component';
import { LayoutPopups } from './popups/component';
import { LayoutPopup } from './popups/popup/component';
import { LayoutSnackBar } from './snackbar/component';
import { LayoutSnackBarMessage } from './snackbar/message/component';

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
    LayoutToolbar,
    LayoutToolbarControls,
    LayoutPopups,
    LayoutPopup,
    LayoutSnackBar,
    LayoutSnackBarMessage,
];

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        AppDirectiviesModule,
        ElementsModule,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatSnackBarModule,
        MatIconModule,
        MatMenuModule,
        JobsModule,
        SessionModule,
        RecentActionsModule,
        LayoutHomeModule,
        OverlayModule,
    ],
    declarations: [...entryComponents],
    exports: [...entryComponents, AppDirectiviesModule],
    bootstrap: [...entryComponents, LayoutHomeModule, ElementsModule]
})
export class LayoutModule {}
