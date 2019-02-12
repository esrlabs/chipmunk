import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { LayoutModule                           } from './layout/module';


@NgModule({
    entryComponents : [ ],
    imports         : [ CommonModule ],
    declarations    : [ ],
    exports         : [ LayoutModule ]
})

export class EnvironmentModule {
    constructor() {
    }
}
