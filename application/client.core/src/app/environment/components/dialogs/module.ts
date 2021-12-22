import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DialogsFileOptionsDltComponent } from './file.options.dlt/component';
import { DialogsFileOptionsDltStatsComponent } from './file.options.dlt/stats/component';

import { DialogsHotkeysMapComponent } from './hotkeys/component';
import { DialogsMultipleFilesActionComponent } from './multiplefiles/component';
import { DialogsRecentFilesActionComponent } from './recentfile/component';
import { DialogsRecentFitlersActionComponent } from './recentfilter/component';
import { DialogsMeasurementAddFormatComponent } from './measurement.format.add/component';
import { DialogsMeasurementFormatDefaultsComponent } from './measurement.format.defaults/component';
import { DialogsAddCommentOnRowComponent } from './comment.row.add/component';
import { DialogsFiltersLoadComponent } from './filters.load/component';

import { PrimitiveModule, ContainersModule } from 'chipmunk-client-material';
import { AppDirectiviesModule } from '../../directives/module';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const CDialogs = [
    DialogsFileOptionsDltComponent,
    DialogsFileOptionsDltStatsComponent,
    DialogsHotkeysMapComponent,
    DialogsMultipleFilesActionComponent,
    DialogsRecentFilesActionComponent,
    DialogsRecentFitlersActionComponent,
    DialogsMeasurementAddFormatComponent,
    DialogsMeasurementFormatDefaultsComponent,
    DialogsAddCommentOnRowComponent,
    DialogsFiltersLoadComponent,
];

@NgModule({
    entryComponents: [...CDialogs],
    imports: [
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
        MatProgressSpinnerModule,
        MatCheckboxModule,
        MatButtonModule,
        MatSelectModule,
        MatExpansionModule,
        AppDirectiviesModule,
        DragDropModule,
    ],
    declarations: [...CDialogs],
    exports: [...CDialogs],
})
export class EnvironmentDialogsModule {
    constructor() {}
}
