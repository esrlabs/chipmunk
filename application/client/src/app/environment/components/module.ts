import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { EnvironmentComplexModule               } from './complex/module';
import { EnvironmentControlsModule              } from './controls/module';
import { EnvironmentSupportModule               } from './support/module';

const modules = [
    EnvironmentComplexModule,
    EnvironmentControlsModule,
    EnvironmentSupportModule
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
