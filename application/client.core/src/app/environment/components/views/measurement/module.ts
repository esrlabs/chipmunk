import { NgModule                                   } from '@angular/core';
import { CommonModule                               } from '@angular/common';

import { ViewMeasurementComponent                   } from './component';
import { ViewMeasurementEntityComponent             } from './entity/component';
import { PrimitiveModule, ContainersModule          } from 'chipmunk-client-material';

const entryComponents = [
    ViewMeasurementComponent,
    ViewMeasurementEntityComponent
];

const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ViewMeasurementModule {
    constructor() {
    }
}
