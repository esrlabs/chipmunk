import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { FormsModule                            } from '@angular/forms';

import { DDListStandardComponent                } from './ddlists/standard/component';

import { InputStandardComponent                 } from './inputs/standard/component';

import { ButtonStandardComponent                } from './buttons/standard/component';

import { SpinnerRegularComponent                } from './spinners/regular/component';
import { SpinnerCircleComponent                 } from './spinners/circle/component';

import { SwitcherSimpleComponent                } from './switchers/simple/component';

import { CheckSimpleComponent                   } from './checkbox/simple/component';

const checkboxes = [
    CheckSimpleComponent
];

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
    SpinnerRegularComponent,
    SpinnerCircleComponent
];

@NgModule({
    entryComponents : [ ...checkboxes, ...switchers, ...ddlists, ...inputs, ...buttons, ...spinners ],
    imports         : [ CommonModule, FormsModule ],
    declarations    : [ ...checkboxes, ...switchers, ...ddlists, ...inputs, ...buttons, ...spinners ],
    exports         : [ ...checkboxes, ...switchers, ...ddlists, ...inputs, ...buttons, ...spinners ]
})

export class PrimitiveModule { }
