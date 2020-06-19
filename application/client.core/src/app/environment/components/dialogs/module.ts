import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DialogsFileOptionsDltComponent         } from './file.options.dlt/component';
import { DialogsFileOptionsDltStatsComponent    } from './file.options.dlt/stats/component';

import { DialogsHotkeysMapComponent             } from './hotkeys/component';
import { DialogsMultipleFilesActionComponent    } from './multiplefiles/component';
import { DialogsRecentFilesActionComponent      } from './recentfile/component';
import { DialogsRecentFitlersActionComponent    } from './recentfilter/component';
import { DialogsMeasurementAddFormatComponent   } from './measurement.format.add/component';

import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';
import { AppDirectiviesModule                   } from '../../directives/module';
import { DragDropModule                         } from '@angular/cdk/drag-drop';

import { MatAutocomplete, MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { MatCheckbox, MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
import { MatFormField, MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBar, MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
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
    DialogsRecentFitlersActionComponent,
    DialogsMeasurementAddFormatComponent,
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
