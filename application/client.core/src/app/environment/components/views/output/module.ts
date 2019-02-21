import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ScrollingModule                        } from '@angular/cdk/scrolling';

import { ViewOutputComponent                    } from './component';
import { ViewOutputRowComponent                 } from './row/component';

import { PrimitiveModule                        } from 'logviewer-client-primitive';
import { ContainersModule                       } from 'logviewer-client-containers';

const entryComponents = [ ViewOutputComponent, ViewOutputRowComponent ];
const components = [ ViewOutputComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, ScrollingModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ViewOutputModule {
    constructor() {
    }
}
