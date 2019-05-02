import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ComplexModule                          } from 'logviewer-client-complex';
import { PrimitiveModule                        } from 'logviewer-client-primitive';
import { ContainersModule                       } from 'logviewer-client-containers';

import { EnvironmentComplexModule               } from './complex/module';
import { EnvironmentViewsModule                 } from './views/module';
import { EnvironmentSizebarAppsModule           } from './sidebar/module';

const modules = [
    EnvironmentComplexModule,
    EnvironmentViewsModule,
    EnvironmentSizebarAppsModule,
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
