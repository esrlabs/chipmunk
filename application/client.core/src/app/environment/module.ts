import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { LayoutModule                           } from './layout/module';
import { EnvironmentComponentsModule            } from './components/module';

@NgModule({
    entryComponents : [ ],
    imports         : [ CommonModule ],
    declarations    : [ ],
    exports         : [ LayoutModule, EnvironmentComponentsModule ]
})

export class EnvironmentModule {
    constructor() {
    }
}
