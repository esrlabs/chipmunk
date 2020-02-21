import { NgModule                                   } from '@angular/core';
import { CommonModule                               } from '@angular/common';
import { ScrollingModule                            } from '@angular/cdk/scrolling';

import { ViewOutputRowComponent                     } from './component';
import { ViewOutputRowStandardComponent             } from './standard/component';
import { ViewOutputRowExternalComponent             } from './external/component';
import { ViewOutputRowColumnsComponent              } from './columns/component';
import { ViewOutputRowColumnsHeadersComponent       } from './columns/headers/component';
import { ViewOutputRowColumnsHeadersMenuComponent   } from './columns/headers/menu/component';

import {
    ComplexModule,
    PrimitiveModule,
    ContainersModule                                } from 'chipmunk-client-material';

const rows = [ ViewOutputRowStandardComponent, ViewOutputRowExternalComponent, ViewOutputRowColumnsComponent, ViewOutputRowColumnsHeadersComponent, ViewOutputRowColumnsHeadersMenuComponent ];
const entryComponents = [ ViewOutputRowComponent, ...rows ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, ScrollingModule, PrimitiveModule, ContainersModule, ComplexModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ViewRowModule {
    constructor() {
    }
}
