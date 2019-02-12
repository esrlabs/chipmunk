import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { LayoutComponent                        } from './component';
import { LayoutStatusBarComponent               } from './bar.status/component';
import { LayoutFunctionsBarComponent            } from './bar.func/component';
import { LayoutPrimaryAreaComponent             } from './area.primary/component';
import { LayoutSecondaryAreaComponent           } from './area.secondary/component';
import { LayoutSecondaryAreaControlsComponent   } from './area.secondary/controls/component';

import { EnvironmentComponentsModule            } from '../components/module';

import { AppsBarStatusModule                    } from '../apps/bar.status/module';


const entryComponents = [
    LayoutStatusBarComponent,
    LayoutFunctionsBarComponent,
    LayoutPrimaryAreaComponent,
    LayoutSecondaryAreaComponent,
    LayoutSecondaryAreaControlsComponent
];

const components = [ LayoutComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, EnvironmentComponentsModule, AppsBarStatusModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class LayoutModule {
    constructor() {
    }
}
