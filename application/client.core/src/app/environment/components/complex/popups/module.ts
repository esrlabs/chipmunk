import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { PopupsComponent                        } from './component';
import { PopupComponent                         } from './popup/component';
import { ComplexPopupsDirective                 } from './directive/popups.directive';

import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';
import { MatButtonModule } from '@angular/material/button';

const entryComponents = [ PopupComponent ];
const components = [ PopupsComponent, ...entryComponents ];
const directives = [ ComplexPopupsDirective ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [
        CommonModule,
        PrimitiveModule,
        ContainersModule,
        MatButtonModule
    ],
    declarations    : [ ...components, ...directives ],
    exports         : [ ...components, ...directives ]
})

export class PopupsModule {
    constructor() {
    }
}
