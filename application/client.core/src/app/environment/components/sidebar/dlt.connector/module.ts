import { NgModule                               } from '@angular/core';
import { DragDropModule                         } from '@angular/cdk/drag-drop';
import { CommonModule                           } from '@angular/common';

import { SidebarAppDLTConnectorComponent        } from './component';

import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';

import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';
import {
    MatExpansionModule,
    MatInputModule,
    MatButtonModule,
    MatProgressBarModule,
} from '@angular/material';

const entryComponents = [ SidebarAppDLTConnectorComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [
        CommonModule,
        PrimitiveModule,
        ContainersModule,
        DragDropModule,
        MatExpansionModule,
        MatInputModule,
        MatButtonModule,
        FormsModule,
        ReactiveFormsModule,
        MatProgressBarModule,
    ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppDLTConnectorModule {
    constructor() {
    }
}
