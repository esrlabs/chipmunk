import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { LongList                               } from './component';
import { LongListItem                           } from './item/component';

@NgModule({
    entryComponents : [ ],
    imports         : [ CommonModule ],
    declarations    : [ LongList, LongListItem ],
    exports         : [ LongList, LongListItem ]
})

export class LongListModule {
    constructor(){
    }
}