import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { PluginAComponent                       } from './component';
import { PluginAItemComponent                   } from './nested/component';

@NgModule({
    entryComponents : [ PluginAItemComponent ],
    imports         : [ CommonModule ],
    declarations    : [ PluginAComponent, PluginAItemComponent ],
    exports         : [ PluginAComponent, PluginAItemComponent ]
})

export class PluginAModule {
    constructor() {
    }
}
