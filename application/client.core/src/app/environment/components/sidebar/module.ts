import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { SidebarAppMergeFilesModule             } from './merge/module';
import { SidebarAppMergeFilesComponent          } from './merge/component';

export const DefaultSidebarApps = [{
    name: 'Merging',
    component: SidebarAppMergeFilesComponent,
}];

@NgModule({
    entryComponents : [  ],
    imports         : [ CommonModule ],
    declarations    : [  ],
    exports         : [ SidebarAppMergeFilesModule ]
})

export class EnvironmentSidebarAppsModule {
    constructor() {
    }
}
