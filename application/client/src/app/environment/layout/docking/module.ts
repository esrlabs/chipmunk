import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { LayoutDockingComponent                 } from './component';
import { LayoutDockingAreaComponent             } from './dock/component';

import { EnvironmentComponentsModule            } from '../../components/module';

const components = [ LayoutDockingComponent, LayoutDockingAreaComponent ];

@NgModule({
    entryComponents : [ ...components ],
    imports         : [ CommonModule, EnvironmentComponentsModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class LayoutDockingModule {
    constructor() {
    }
}
