import { NgModule                                   } from '@angular/core';
import { CommonModule                               } from '@angular/common';
import { MatSliderModule                            } from '@angular/material';
import { PrimitiveModule                            } from 'chipmunk-client-primitive';
import { ContainersModule                           } from 'chipmunk-client-containers';

import { SidebarAppSearchRequestsComponent          } from './component';
import { SidebarAppSearchRequestComponent           } from './request/component';
import { SidebarAppSearchRequestDetailsComponent    } from './detailsrequest/component';
import { SidebarAppSearchChartDetailsComponent      } from './detailschart/component';
import { SidebarAppSearchChartEntryComponent        } from './chartentry/component';
import { MatSlider                                  } from '@angular/material';


const entryComponents = [
    SidebarAppSearchRequestsComponent,
    SidebarAppSearchRequestComponent,
    SidebarAppSearchRequestDetailsComponent,
    SidebarAppSearchChartEntryComponent,
    SidebarAppSearchChartDetailsComponent,
    MatSlider
];

const components = [
    SidebarAppSearchRequestsComponent,
    SidebarAppSearchRequestComponent,
    SidebarAppSearchRequestDetailsComponent,
    SidebarAppSearchChartEntryComponent,
    SidebarAppSearchChartDetailsComponent
];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule, MatSliderModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppSearchRequestsModule {
    constructor() {
    }
}
