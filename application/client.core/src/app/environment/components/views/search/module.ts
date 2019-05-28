import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { FormsModule                            } from '@angular/forms';
import { ScrollingModule                        } from '@angular/cdk/scrolling';

import { ViewSearchComponent                    } from './component';
import { ViewSearchOutputComponent              } from './output/component';
import { ViewSearchOutputRowComponent           } from './output/row/component';

import { PrimitiveModule                        } from 'logviewer-client-primitive';
import { ContainersModule                       } from 'logviewer-client-containers';
import { ComplexModule                          } from 'logviewer-client-complex';


const entryComponents = [ ViewSearchComponent, ViewSearchOutputComponent, ViewSearchOutputRowComponent ];
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
