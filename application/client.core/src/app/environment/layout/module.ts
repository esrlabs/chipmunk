import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ContainersModule                       } from 'logviewer-client-containers';

import { LayoutComponent                        } from './component';
import { LayoutStatusBarComponent               } from './bar.status/component';
import { LayoutSessionSidebarComponent          } from './area.sidebar/component';
import { LayoutPrimaryAreaComponent             } from './area.primary/component';
import { LayoutPrimiryAreaControlsComponent     } from './area.primary/controls/component';
import { LayoutPrimiryAreaNoTabsComponent       } from './area.primary/no-tabs-content/component';
import { LayoutSecondaryAreaComponent           } from './area.secondary/component';
import { LayoutSecondaryAreaControlsComponent   } from './area.secondary/controls/component';

import { EnvironmentComponentsModule            } from '../components/module';

import { AppsBarStatusModule                    } from '../apps/bar.status/module';


const entryComponents = [
    LayoutStatusBarComponent,
    LayoutSessionSidebarComponent,
    LayoutPrimaryAreaComponent,
    LayoutPrimiryAreaControlsComponent,
    LayoutPrimiryAreaNoTabsComponent,
    LayoutSecondaryAreaComponent,
    LayoutSecondaryAreaControlsComponent
];

const components = [ LayoutComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, ContainersModule, EnvironmentComponentsModule, AppsBarStatusModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class LayoutModule {
    constructor() {
    }
}
