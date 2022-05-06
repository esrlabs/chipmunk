import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatListModule } from '@angular/material/list';

import { TabSourceDltFile } from './component';
import { TabSourceDltFileStructure } from './structure/component';
import { TabSourceDltFileTimezone } from './timezones/component';

const entryComponents = [TabSourceDltFile, TabSourceDltFileStructure, TabSourceDltFileTimezone];
const components = [TabSourceDltFile, TabSourceDltFileStructure, TabSourceDltFileTimezone];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatTableModule,
        MatSortModule,
        MatProgressBarModule,
        MatChipsModule,
        MatIconModule,
        MatFormFieldModule,
        MatSelectModule,
        MatBottomSheetModule,
        MatListModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class TabSourceDltFileModule {
    constructor() {}
}
