import { ContainersModule                   } from '../containers.module';
import { NgModule                           } from '@angular/core';
import { CommonModule                       } from '@angular/common';

import { TabsComponent                      } from './component';
import { TabsListComponent                  } from './list/component';
import { TabContentComponent                } from './content/component';

export {
    TabsComponent,
    TabsListComponent,
    TabContentComponent,
};

const entryComponents = [ TabsListComponent, TabContentComponent, TabsComponent ];
const components = [ TabsComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class TabsModule {
    constructor() {
    }
}
