import { NgModule                               } from '@angular/core';
import { DragDropModule                         } from '@angular/cdk/drag-drop';
import { CommonModule                           } from '@angular/common';

import { SidebarAppConcatFilesComponent         } from './component';

import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';

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
