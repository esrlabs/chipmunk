import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';

import { NestedDictionary } from './component';
import { NestedDictionaryStructure } from './structure/component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatProgressBarModule,
        MatChipsModule,
        MatIconModule,
        MatFormFieldModule,
        MatSelectModule,
        MatListModule,
        MatTableModule,
        MatSortModule,
    ],
    declarations: [NestedDictionary, NestedDictionaryStructure],
    exports: [NestedDictionary],
    bootstrap: [NestedDictionary, NestedDictionaryStructure],
})
export class NestedDictionaryModule {}
