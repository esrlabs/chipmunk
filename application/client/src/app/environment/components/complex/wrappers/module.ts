import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { WrappersFrameComponent                 } from './frame/component';

import { EnvironmentSupportModule               } from '../../support/module';
import { EnvironmentControlsModule              } from '../../controls/module';

const entryComponents = [ WrappersFrameComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, EnvironmentSupportModule, EnvironmentControlsModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class WrappersModule {
    constructor() {
    }
}
