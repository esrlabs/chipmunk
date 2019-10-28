import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ComplexModule                          } from 'chipmunk-client-complex';
import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';

import { EnvironmentComplexModule               } from './complex/module';
import { EnvironmentViewsModule                 } from './views/module';
import { EnvironmentSidebarAppsModule           } from './sidebar/module';
import { EnvironmentDialogsModule               } from './dialogs/module';

const modules = [
    EnvironmentComplexModule,
    EnvironmentViewsModule,
    EnvironmentSidebarAppsModule,
    EnvironmentDialogsModule,
    ComplexModule,
    PrimitiveModule,
    ContainersModule
];

@NgModule({
    entryComponents : [ ],
    imports         : [ CommonModule ],
    declarations    : [ ],
    exports         : [ ...modules  ]
})

export class EnvironmentComponentsModule {
    constructor() {
    }
}
