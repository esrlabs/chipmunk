import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ButtonStandardComponent                } from './buttons/standard/component';

import { SpinnerRegularComponent                } from './spinners/regular/component';


const buttons = [
    ButtonStandardComponent
];

const spinners = [
    SpinnerRegularComponent
];

@NgModule({
    entryComponents : [ ...buttons, ...spinners ],
    imports         : [ CommonModule ],
    declarations    : [ ...buttons, ...spinners ],
    exports         : [ ...buttons, ...spinners ]
})

export class PrimitiveModule { }
