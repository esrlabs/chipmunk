import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { PopupsComponent                        } from './component';
import { PopupComponent                         } from './popup/component';

import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';
import { MatButtonModule } from '@angular/material/button';

const entryComponents = [ PopupComponent ];
const components = [ PopupsComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [
        CommonModule,
        PrimitiveModule,
        ContainersModule,
        MatButtonModule
    ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class PopupsModule {
    constructor() {
    }
}
