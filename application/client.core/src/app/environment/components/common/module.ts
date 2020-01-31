import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ComColorSelectorComponent              } from './color.selector/component';

@NgModule({
    entryComponents : [ ComColorSelectorComponent ],
    imports         : [ CommonModule ],
    declarations    : [ ComColorSelectorComponent ],
    exports         : [ ComColorSelectorComponent ]
})

export class EnvironmentCommonModule {
    constructor() {
    }
}
