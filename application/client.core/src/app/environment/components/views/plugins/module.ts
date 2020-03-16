import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ScrollingModule                        } from '@angular/cdk/scrolling';

import { ViewPluginsComponent                   } from './component';
import { ViewPluginsListComponent               } from './list/component';
import { ViewPluginsPluginComponent             } from './list/plugin/component';
import { ViewPluginsDetailsComponent            } from './details/component';

import {
    ComplexModule,
    PrimitiveModule,
    ContainersModule                            } from 'chipmunk-client-material';
import { AppDirectiviesModule                   } from '../../../directives/module';

import {
    MatFormField,
    MatAutocomplete,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatOptionModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatProgressBarModule } from '@angular/material';
import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';

const entryComponents = [ ViewPluginsComponent, ViewPluginsListComponent, ViewPluginsPluginComponent, ViewPluginsDetailsComponent, MatFormField, MatAutocomplete ];
const components = [ ViewPluginsComponent, ViewPluginsListComponent, ViewPluginsPluginComponent, ViewPluginsDetailsComponent ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [
        CommonModule,
        ScrollingModule,
        PrimitiveModule,
        ContainersModule,
        ComplexModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatAutocompleteModule,
        MatOptionModule,
        MatButtonModule,
        AppDirectiviesModule,
        MatProgressSpinnerModule,
        MatProgressBarModule
    ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ViewPluginsModule {
    constructor() {
    }
}

