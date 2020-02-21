import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { SidebarAppMergeFilesComponent          } from './component';
import { SidebarAppMergeFilesItemComponent      } from './file/component';

import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';

const entryComponents = [ SidebarAppMergeFilesComponent, SidebarAppMergeFilesItemComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppMergeFilesModule {
    constructor() {
    }
}
