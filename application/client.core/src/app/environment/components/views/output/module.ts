import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ScrollingModule                        } from '@angular/cdk/scrolling';
import { ViewRowModule                          } from '../row/module';
import { ViewOutputComponent                    } from './component';
import { ViewOutputControlsComponent            } from './controls/component';
import { ViewContentMapComponent                } from './map/component';

import { PrimitiveModule                        } from 'logviewer-client-primitive';
import { ContainersModule                       } from 'logviewer-client-containers';
import { ComplexModule                          } from 'logviewer-client-complex';

const entryComponents = [ ViewOutputComponent, ViewOutputControlsComponent, ViewContentMapComponent ];
const components = [ ViewOutputComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, ScrollingModule, PrimitiveModule, ContainersModule, ComplexModule, ViewRowModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ViewOutputModule {
    constructor() {
    }
}
