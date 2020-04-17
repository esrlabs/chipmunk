import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ComplexScrollBoxComponent              } from './component';
import { ComplexScrollBoxSBVComponent           } from './sbv/component';
import { ComplexScrollBoxSBHComponent           } from './sbh/component';

import { PrimitiveModule                        } from '../primitive.module';
import { ContainersModule                       } from '../containers.module';

export {
    ComplexScrollBoxComponent,
    ComplexScrollBoxSBVComponent,
    ComplexScrollBoxSBHComponent,
};

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
