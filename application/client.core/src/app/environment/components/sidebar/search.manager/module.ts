import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { SidebarAppSearchManagerComponent       } from './component';
import { SidebarAppSearchRequestsModule         } from './requests/module';

import { PrimitiveModule                        } from 'logviewer-client-primitive';
import { ContainersModule                       } from 'logviewer-client-containers';

const entryComponents = [ SidebarAppSearchManagerComponent ];
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
