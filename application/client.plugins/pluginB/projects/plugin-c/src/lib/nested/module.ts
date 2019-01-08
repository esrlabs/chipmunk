import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { PluginCNestedComponent                 } from './component';
import { PluginCItemComponent                   } from './nested/component';

@NgModule({
    entryComponents : [ PluginCItemComponent ],
    imports         : [ CommonModule ],
    declarations    : [ PluginCItemComponent, PluginCNestedComponent ],
    exports         : [ PluginCItemComponent, PluginCNestedComponent ]
})

export class PluginCNestedModule {
    constructor() {
    }
}
