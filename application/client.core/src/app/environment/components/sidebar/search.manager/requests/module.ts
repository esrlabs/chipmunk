import { NgModule                                   } from '@angular/core';
import { CommonModule                               } from '@angular/common';

import { SidebarAppSearchRequestsComponent          } from './component';
import { SidebarAppSearchRequestComponent           } from './request/component';
import { SidebarAppSearchRequestDetailsComponent    } from './detailsrequest/component';
import { SidebarAppSearchChartDetailsComponent      } from './detailschart/component';
import { SidebarAppSearchChartEntryComponent        } from './chartentry/component';
import { PrimitiveModule                            } from 'chipmunk-client-primitive';
import { ContainersModule                           } from 'chipmunk-client-containers';

const entryComponents = [
    SidebarAppSearchRequestsComponent,
    SidebarAppSearchRequestComponent,
    SidebarAppSearchRequestDetailsComponent,
    SidebarAppSearchChartEntryComponent,
    SidebarAppSearchChartDetailsComponent];

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
