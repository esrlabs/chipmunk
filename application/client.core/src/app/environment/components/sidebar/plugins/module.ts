import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';
import { AppDirectiviesModule                   } from '../../../directives/module';
import { DragDropModule                         } from '@angular/cdk/drag-drop';
import { EnvironmentCommonModule                } from '../../common/module';

import {
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatOptionModule,
    MatSortModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatButtonModule,
    MatSelectModule,
    MatExpansionModule,
    MatSliderModule,
    MatTableModule,
    MatSlider } from '@angular/material';
import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';

import { SidebarAppPluginsComponent } from './component';

const entryComponents = [
    SidebarAppPluginsComponent,
];
const components = [ ...entryComponents ];
const modules = [
    CommonModule,
    PrimitiveModule,
    ContainersModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    MatOptionModule,
    MatSortModule,
    MatTableModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatButtonModule,
    MatSelectModule,
    AppDirectiviesModule,
    MatExpansionModule,
    MatSliderModule,
    DragDropModule,
    EnvironmentCommonModule
];

@NgModule({
    entryComponents : [ ...entryComponents, MatSlider ],
    imports         : [ ...modules ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppPluginsModule {
    constructor() {
    }
}
