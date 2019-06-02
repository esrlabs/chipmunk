import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ScrollingModule                        } from '@angular/cdk/scrolling';

import { ViewOutputComponent                    } from './component';
import { ViewOutputRowComponent                 } from './row/component';
import { ViewOutputControlsComponent            } from './controls/component';

import { PrimitiveModule                        } from 'logviewer-client-primitive';
import { ContainersModule                       } from 'logviewer-client-containers';
import { ComplexModule                          } from 'logviewer-client-complex';

const entryComponents = [ ViewOutputComponent, ViewOutputRowComponent, ViewOutputControlsComponent ];
const components = [ ViewOutputComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, ScrollingModule, PrimitiveModule, ContainersModule, ComplexModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ViewOutputModule {
    constructor() {
    }
}
