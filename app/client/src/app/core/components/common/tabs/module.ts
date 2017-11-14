import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { CommonTabs                             } from './component';
import { TabItem                                } from './tab/component';

@NgModule({
    entryComponents : [ ],
    imports         : [ CommonModule ],
    declarations    : [ CommonTabs, TabItem ],
    exports         : [ CommonTabs, TabItem ]
})

export class CommonTabModule {
    constructor(){
    }
}