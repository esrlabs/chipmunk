import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { FormsModule                            } from '@angular/forms';

import { DDListStandardComponent                } from './ddlists/standard/component';

import { InputStandardComponent                 } from './inputs/standard/component';

import { ButtonStandardComponent                } from './buttons/standard/component';

import { SpinnerRegularComponent                } from './spinners/regular/component';

const ddlists = [
    DDListStandardComponent
];

const inputs = [
    InputStandardComponent
];

const buttons = [
    ButtonStandardComponent
];

const spinners = [
    SpinnerRegularComponent
];

@NgModule({
    entryComponents : [ ...ddlists, ...inputs, ...buttons, ...spinners ],
    imports         : [ CommonModule, FormsModule ],
    declarations    : [ ...ddlists, ...inputs, ...buttons, ...spinners ],
    exports         : [ ...ddlists, ...inputs, ...buttons, ...spinners ]
})

export class PrimitiveModule { }
