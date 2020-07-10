import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { TabsModule                             } from './tabs/module';
import { ScrollBoxModule                        } from './scrollbox/module';


@NgModule({
    entryComponents : [  ],
    imports         : [ CommonModule ],
    declarations    : [  ],
    exports         : [ TabsModule, ScrollBoxModule ]
})

export class ComplexModule { }
