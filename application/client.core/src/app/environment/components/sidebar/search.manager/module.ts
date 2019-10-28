import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { SidebarAppSearchManagerComponent       } from './component';
import { SidebarAppSearchManagerControlsComponent} from './requests/controls/component';
import { SidebarAppSearchRequestsModule         } from './requests/module';

import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';

const entryComponents = [ SidebarAppSearchManagerComponent, SidebarAppSearchManagerControlsComponent ];
const components = [ ...entryComponents ];
const modules = [ CommonModule, PrimitiveModule, ContainersModule, SidebarAppSearchRequestsModule ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ ...modules ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppSearchManagerModule {
    constructor() {
    }
}
