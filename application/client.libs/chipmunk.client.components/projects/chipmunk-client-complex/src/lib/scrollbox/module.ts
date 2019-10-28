import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ComplexScrollBoxComponent              } from './component';
import { ComplexScrollBoxSBVComponent           } from './sbv/component';
import { ComplexScrollBoxSBHComponent           } from './sbh/component';

import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';

const entryComponents = [ ComplexScrollBoxComponent, ComplexScrollBoxSBVComponent, ComplexScrollBoxSBHComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ScrollBoxModule {
    constructor() {
    }
}
