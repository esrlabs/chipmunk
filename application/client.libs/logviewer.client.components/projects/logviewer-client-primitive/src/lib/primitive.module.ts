import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { FormsModule                            } from '@angular/forms';

import { DDListStandardComponent                } from './ddlists/standard/component';

import { InputStandardComponent                 } from './inputs/standard/component';

import { ButtonStandardComponent                } from './buttons/standard/component';

import { SpinnerRegularComponent                } from './spinners/regular/component';

import { SwitcherSimpleComponent                } from './switchers/simple/component';

const switchers = [
    SwitcherSimpleComponent
];

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
    entryComponents : [ ...switchers, ...ddlists, ...inputs, ...buttons, ...spinners ],
    imports         : [ CommonModule, FormsModule ],
    declarations    : [ ...switchers, ...ddlists, ...inputs, ...buttons, ...spinners ],
    exports         : [ ...switchers, ...ddlists, ...inputs, ...buttons, ...spinners ]
})

export class PrimitiveModule { }
