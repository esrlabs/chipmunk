import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { AppsStatusBarElectronStateComponent    } from './electron.state/component';

import { EnvironmentComponentsModule            } from '../../components/module';

const entryComponents = [
    AppsStatusBarElectronStateComponent,
];

const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, EnvironmentComponentsModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class AppsBarStatusModule {
    constructor() {
    }
}
