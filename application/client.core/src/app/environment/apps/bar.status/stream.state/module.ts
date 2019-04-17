import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { AppsStatusBarStreamStateComponent      } from './component';
import { EnvironmentComponentsModule            } from '../../../components/module';

const components = [ AppsStatusBarStreamStateComponent ];

@NgModule({
    entryComponents : [ ...components ],
    imports         : [ CommonModule, EnvironmentComponentsModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class StreamStateModule {
    constructor() {
    }
}
