import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { TabsModule                             } from './tabs/module';
import { DockingModule                          } from './docking/module';


@NgModule({
    entryComponents : [  ],
    imports         : [ CommonModule ],
    declarations    : [  ],
    exports         : [ TabsModule, DockingModule ]
})

export class ComplexModule { }
