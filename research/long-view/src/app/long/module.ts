import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ComplexInfinityOutputComponent         } from './component';
import { ComplexInfinityOutputSBVComponent      } from './sbv/component';

import { PrimitiveModule                        } from 'logviewer-client-primitive';
import { ContainersModule                       } from 'logviewer-client-containers';

const entryComponents = [ ComplexInfinityOutputComponent, ComplexInfinityOutputSBVComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ComplexInfinityOutputModule {
    constructor() {
    }
}
