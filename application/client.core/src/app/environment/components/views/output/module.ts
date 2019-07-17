import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ScrollingModule                        } from '@angular/cdk/scrolling';

import { ViewOutputComponent                    } from './component';
import { ViewOutputRowComponent                 } from './row/component';
import { ViewOutputRowStandardComponent         } from './row/standard/component';
import { ViewOutputRowExternalComponent         } from './row/external/component';
import { ViewOutputRowColumnsComponent          } from './row/columns/component';
import { ViewOutputRowColumnsHeadersComponent   } from './row/columns/headers/component';
import { ViewOutputRowColumnsHeadersMenuComponent   } from './row/columns/headers/menu/component';

import { ViewOutputControlsComponent            } from './controls/component';

import { PrimitiveModule                        } from 'logviewer-client-primitive';
import { ContainersModule                       } from 'logviewer-client-containers';
import { ComplexModule                          } from 'logviewer-client-complex';

const rows = [ ViewOutputRowStandardComponent, ViewOutputRowExternalComponent, ViewOutputRowColumnsComponent, ViewOutputRowColumnsHeadersComponent, ViewOutputRowColumnsHeadersMenuComponent ];
const entryComponents = [ ViewOutputComponent, ViewOutputRowComponent, ViewOutputControlsComponent, ...rows ];
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
