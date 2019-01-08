import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ButtonStandardComponent                } from './buttons/standard/component';

const buttons = [
    ButtonStandardComponent
];

@NgModule({
    entryComponents : [ ...buttons ],
    imports         : [ CommonModule ],
    declarations    : [ ...buttons ],
    exports         : [ ...buttons ]
})

export class EnvironmentControlsModule {
    constructor() {
    }
}
