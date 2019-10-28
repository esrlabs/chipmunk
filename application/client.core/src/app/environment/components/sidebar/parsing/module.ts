import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { SidebarAppParsingComponent             } from './component';

import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';

const entryComponents = [ SidebarAppParsingComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppParsingModule {
    constructor() {
    }
}
