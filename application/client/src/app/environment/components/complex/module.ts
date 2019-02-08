import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { NotificationsModule                    } from './notifications/module';
import { TabsModule                             } from './tabs/module';
import { DockingModule                          } from './docking/module';
import { WrappersModule                         } from './wrappers/module';


@NgModule({
    entryComponents : [  ],
    imports         : [ CommonModule ],
    declarations    : [  ],
    exports         : [ NotificationsModule, TabsModule, DockingModule, WrappersModule ]
})

export class EnvironmentComplexModule {
    constructor() {
    }
}
