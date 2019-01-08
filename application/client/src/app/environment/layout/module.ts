import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { LayoutComponent                        } from './component';
import { LayoutStatusBarComponent               } from './bar.status/component';
import { LayoutTopBarComponent                  } from './bar.func/component';

import { EnvironmentComponentsModule            } from '../components/module';
import { LayoutTabsModule                       } from './tabs/module';
import { LayoutDockingModule                    } from './docking/module';

const entryComponents = [ LayoutStatusBarComponent, LayoutTopBarComponent ];
const components = [ LayoutComponent, ...entryComponents ];


@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, LayoutTabsModule, LayoutDockingModule, EnvironmentComponentsModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class LayoutModule {
    constructor() {
    }
}
