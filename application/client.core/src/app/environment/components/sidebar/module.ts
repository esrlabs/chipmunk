import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { SidebarAppMergeFilesModule             } from './merge/module';
import { SidebarAppMergeFilesComponent          } from './merge/component';

import { SidebarAppSearchManagerModule          } from './search.manager/module';
import { SidebarAppSearchManagerComponent       } from './search.manager/component';

@NgModule({
    entryComponents : [  ],
    imports         : [ CommonModule ],
    declarations    : [  ],
    exports         : [ SidebarAppMergeFilesModule, SidebarAppSearchManagerModule ]
})

export class EnvironmentSidebarAppsModule {
    constructor() {
    }
}
