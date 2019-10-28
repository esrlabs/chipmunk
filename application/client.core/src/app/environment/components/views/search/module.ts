import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { FormsModule                            } from '@angular/forms';
import { ScrollingModule                        } from '@angular/cdk/scrolling';

import { ViewSearchComponent                    } from './component';
import { ViewSearchOutputComponent              } from './output/component';
import { ViewSearchControlsComponent            } from './output/controls/component';

import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';
import { ComplexModule                          } from 'chipmunk-client-complex';


const entryComponents = [ ViewSearchComponent, ViewSearchOutputComponent, ViewSearchControlsComponent ];
const components = [ ViewSearchComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, ScrollingModule, PrimitiveModule, ContainersModule, ComplexModule, FormsModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ViewSearchModule {
    constructor() {
    }
}

