import { NgModule                                   } from '@angular/core';
import { CommonModule                               } from '@angular/common';

import { ViewTerminalComponent                      } from './component';
import { PrimitiveModule, ContainersModule          } from 'chipmunk-client-material';

const entryComponents = [ ViewTerminalComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ViewTerminalModule {
    constructor() {
    }
}
