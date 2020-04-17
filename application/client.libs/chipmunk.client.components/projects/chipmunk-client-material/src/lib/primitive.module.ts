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

import { SliderNumericComponent                 } from './sliders/numeric/component';

export {
    DDListStandardComponent,
    InputStandardComponent,
    ButtonStandardComponent,
    SpinnerRegularComponent,
    SpinnerCircleComponent,
    SwitcherSimpleComponent,
    CheckSimpleComponent,
    SliderNumericComponent,
};

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

const sliders = [
    SliderNumericComponent
];

@NgModule({
    entryComponents : [ ...checkboxes, ...switchers, ...ddlists, ...inputs, ...buttons, ...spinners, ...sliders ],
    imports         : [ CommonModule, FormsModule ],
    declarations    : [ ...checkboxes, ...switchers, ...ddlists, ...inputs, ...buttons, ...spinners, ...sliders ],
    exports         : [ ...checkboxes, ...switchers, ...ddlists, ...inputs, ...buttons, ...spinners, ...sliders ]
})

export class PrimitiveModule { }
