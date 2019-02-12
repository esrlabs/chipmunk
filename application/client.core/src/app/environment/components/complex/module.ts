import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { NotificationsModule                    } from './notifications/module';

@NgModule({
    entryComponents : [  ],
    imports         : [ CommonModule ],
    declarations    : [  ],
    exports         : [ NotificationsModule, /*TabsModule, DockingModule, WrappersModule */]
})

export class EnvironmentComplexModule {
    constructor() {
    }
}
