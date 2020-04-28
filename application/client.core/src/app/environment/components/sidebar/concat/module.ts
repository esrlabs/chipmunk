import { NgModule                               } from '@angular/core';
import { DragDropModule                         } from '@angular/cdk/drag-drop';
import { CommonModule                           } from '@angular/common';

import { SidebarAppConcatFilesComponent         } from './component';

import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';


import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';

const entryComponents = [ SidebarAppConcatFilesComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [
        DragDropModule,
        CommonModule,
        PrimitiveModule,
        ContainersModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatTooltipModule,
        MatExpansionModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatTableModule,
        MatSortModule,
    ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppConcatFilesModule {
    constructor() {
    }
}
