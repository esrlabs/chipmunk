import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ComplexInfinityOutputComponent         } from './component';

import { ContainersModule                       } from 'logviewer-client-containers';

const entryComponents = [ ComplexInfinityOutputComponent ];
const components = [ ComplexInfinityOutputComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class InfinityOutputModule {
    constructor() {
    }
}
