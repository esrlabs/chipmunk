import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { NotificationsModule                    } from './notifications/module';
import { TabsModule                             } from './tabs/module';
import { DockingModule                          } from './docking/module';


@NgModule({
    entryComponents : [  ],
    imports         : [ CommonModule ],
    declarations    : [  ],
    exports         : [ NotificationsModule, TabsModule, DockingModule ]
})

export class EnvironmentComplexModule {
    constructor() {
    }
}
