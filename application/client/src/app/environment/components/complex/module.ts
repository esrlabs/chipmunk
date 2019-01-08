import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { NotificationsModule                    } from './notifications/module';

@NgModule({
    entryComponents : [  ],
    imports         : [ CommonModule ],
    declarations    : [  ],
    exports         : [ NotificationsModule ]
})

export class EnvironmentComplexModule {
    constructor() {
    }
}
