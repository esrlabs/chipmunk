import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DialogsFileOptionsDltComponent         } from './file.options.dlt/component';
import { DialogsFileOptionsDltStatsComponent    } from './file.options.dlt/stats/component';

import { DialogsHotkeysMapComponent             } from './hotkeys/component';
import { DialogsMultipleFilesActionComponent    } from './multiplefiles/component';
import { DialogsRecentFilesActionComponent      } from './recentfile/component';
import { DialogsRecentFitlersActionComponent    } from './recentfilter/component';

import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';
import { AppDirectiviesModule                   } from '../../directives/module';
import { DragDropModule                         } from '@angular/cdk/drag-drop';

import {
    MatFormField,
    MatAutocomplete,
    MatProgressBar,
    MatCheckbox,
    MatButton,
    MatSelect,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatOptionModule,
    MatSortModule,
    MatTable,
    MatProgressBarModule,
    MatCheckboxModule,
    MatButtonModule,
    MatSelectModule,
    MatTableModule } from '@angular/material';
import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';

const entryComponents = [
    MatFormField,
    MatAutocomplete,
    MatTable,
    MatProgressBar,
    MatCheckbox,
    MatButton,
    MatSelect,
];

const CDialogs = [
    DialogsFileOptionsDltComponent,
    DialogsFileOptionsDltStatsComponent,
    DialogsHotkeysMapComponent,
    DialogsMultipleFilesActionComponent,
    DialogsRecentFilesActionComponent,
    DialogsRecentFitlersActionComponent
];

@NgModule({
    entryComponents : [ ...CDialogs, ...entryComponents ],
    imports         : [
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
        DragDropModule
    ],
    declarations    : [ ...CDialogs ],
    exports         : [ ...CDialogs ],
})

export class EnvironmentDialogsModule {
    constructor() {
    }
}
