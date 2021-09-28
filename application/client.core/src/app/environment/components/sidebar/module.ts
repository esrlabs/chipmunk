import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SidebarAppParsingModule } from './parsing/module';

import { SidebarAppMergeFilesModule } from './merge/module';
import { SidebarAppMergeFilesComponent } from './merge/component';

import { SidebarAppConcatFilesModule } from './concat/module';
import { SidebarAppConcatFilesComponent } from './concat/component';

import { SidebarAppSearchManagerModule } from './search.manager/module';
import { SidebarAppSearchManagerComponent } from './search.manager/component';

import { SidebarAppDLTConnectorModule } from './dlt.connector/module';
import { SidebarAppDLTConnectorComponent } from './dlt.connector/component';

import { SidebarAppNotificationsModule } from '../views/notifications/module';
import { SidebarAppNotificationsComponent } from '../views/notifications/component';

import { SidebarAppCommentsModule } from '../sidebar/comments/module';
import { SidebarAppCommentsComponent } from '../sidebar/comments/component';

import { SidebarAppShellModule } from './shell/module';

import { SidebarAppAdbModule } from './adb/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule],
    declarations: [],
    exports: [
        SidebarAppMergeFilesModule,
        SidebarAppSearchManagerModule,
        SidebarAppParsingModule,
        SidebarAppNotificationsModule,
        SidebarAppConcatFilesModule,
        SidebarAppDLTConnectorModule,
        SidebarAppCommentsModule,
        SidebarAppShellModule,
        SidebarAppAdbModule,
    ],
})
export class EnvironmentSidebarAppsModule {
    constructor() {}
}
