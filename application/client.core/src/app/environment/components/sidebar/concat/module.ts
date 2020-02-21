import { NgModule                               } from '@angular/core';
import { DragDropModule                         } from '@angular/cdk/drag-drop';
import { CommonModule                           } from '@angular/common';

import { SidebarAppConcatFilesComponent         } from './component';

import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';

const entryComponents = [ SidebarAppConcatFilesComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule, DragDropModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppConcatFilesModule {
    constructor() {
    }
}
