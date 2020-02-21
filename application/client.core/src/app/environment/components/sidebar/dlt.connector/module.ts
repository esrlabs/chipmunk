import { NgModule                               } from '@angular/core';
import { DragDropModule                         } from '@angular/cdk/drag-drop';
import { CommonModule                           } from '@angular/common';

import { SidebarAppDLTConnectorComponent        } from './component';

import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';
import { AppDirectiviesModule                   } from '../../../directives/module';

import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';
import {
    MatExpansionModule,
    MatInputModule,
    MatButtonModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatAutocompleteModule,
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
        MatCheckboxModule,
        MatAutocompleteModule,
        AppDirectiviesModule
    ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppDLTConnectorModule {
    constructor() {
    }
}
