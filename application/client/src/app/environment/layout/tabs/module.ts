import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { LayoutTabsComponent                    } from './component';
import { LayoutTabsListComponent                } from './list/component';
import { LayoutTabContentComponent              } from './content/component';

import { EnvironmentComponentsModule            } from '../../components/module';
import { LayoutDockingModule                    } from '../docking/module';

const entryComponents = [ LayoutTabsListComponent, LayoutTabContentComponent, LayoutTabsComponent ];
const components = [ LayoutTabsComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, EnvironmentComponentsModule, LayoutDockingModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class LayoutTabsModule {
    constructor() {
    }
}
