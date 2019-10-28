import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { SidebarAppChartsComponent              } from './component';
import { SidebarAppChartsEntryComponent         } from './entry/component';
import { SidebarAppChartsControlsComponent      } from './controls/component';
import { SidebarAppChartsControlsCallerComponent } from './controls.caller/component';

import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';

const entryComponents = [ SidebarAppChartsComponent, SidebarAppChartsEntryComponent, SidebarAppChartsControlsComponent, SidebarAppChartsControlsCallerComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppChartsModule {
    constructor() {
    }
}
