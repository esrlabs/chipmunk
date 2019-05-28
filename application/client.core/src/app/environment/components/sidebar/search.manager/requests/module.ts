import { NgModule                                   } from '@angular/core';
import { CommonModule                               } from '@angular/common';

import { SidebarAppSearchRequestsComponent          } from './component';
import { SidebarAppSearchRequestComponent           } from './request/component';
import { SidebarAppSearchRequestDetailsComponent    } from './details/component';

import { PrimitiveModule                            } from 'logviewer-client-primitive';
import { ContainersModule                           } from 'logviewer-client-containers';

const entryComponents = [ SidebarAppSearchRequestsComponent, SidebarAppSearchRequestComponent, SidebarAppSearchRequestDetailsComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppSearchRequestsModule {
    constructor() {
    }
}
