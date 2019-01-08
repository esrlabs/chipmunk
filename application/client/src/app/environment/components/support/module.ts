import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DynamicComponent                       } from './dynamic/component';

const components = [
    DynamicComponent
];

@NgModule({
    entryComponents : [ ...components ],
    imports         : [ CommonModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class EnvironmentSupportModule {
    constructor() {
    }
}
