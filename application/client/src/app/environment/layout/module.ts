import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { LayoutComponent                        } from './component';
import { LayoutStatusBarComponent               } from './bar.status/component';
import { LayoutTopBarComponent                  } from './bar.func/component';

import { EnvironmentComponentsModule            } from '../components/module';

const entryComponents = [ LayoutStatusBarComponent, LayoutTopBarComponent ];
const components = [ LayoutComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, EnvironmentComponentsModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class LayoutModule {
    constructor() {
    }
}
