import { ContainersModule                       } from '../containers.module';
import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DockingComponent                       } from './component';
import { DockComponent                          } from './dock/component';
import { DockContainerComponent                 } from './container/component';

const components = [ DockingComponent, DockComponent, DockContainerComponent];

@NgModule({
    entryComponents : [ ...components ],
    imports         : [ CommonModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class DockingModule {
    constructor() {
    }
}
