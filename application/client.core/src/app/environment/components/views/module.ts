import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ViewOutputModule                       } from './output/module';

@NgModule({
    entryComponents : [  ],
    imports         : [ CommonModule ],
    declarations    : [  ],
    exports         : [ ViewOutputModule ]
})

export class EnvironmentViewsModule {
    constructor() {
    }
}
