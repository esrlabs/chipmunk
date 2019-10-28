import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { PopupsComponent                        } from './component';
import { PopupComponent                         } from './popup/component';

import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';

const entryComponents = [ PopupComponent ];
const components = [ PopupsComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class PopupsModule {
    constructor() {
    }
}
