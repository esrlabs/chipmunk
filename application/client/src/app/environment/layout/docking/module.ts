import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { LayoutDockingComponent                 } from './component';
import { LayoutDockComponent                    } from './dock/component';
import { LayoutDockContainerComponent           } from './container/component';

import { EnvironmentComponentsModule            } from '../../components/module';

const components = [ LayoutDockingComponent, LayoutDockComponent, LayoutDockContainerComponent];

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
