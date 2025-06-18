import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';

import { NestedDictionary } from './component';
import { NestedDictionaryStructure } from './structure/component';

@NgModule({
    imports: [
        CommonModule,
        MatCardModule,
        MatDividerModule,
        MatProgressBarModule,
        MatTableModule,
        MatSortModule,
    ],
    declarations: [NestedDictionary, NestedDictionaryStructure],
    exports: [NestedDictionary],
    bootstrap: [NestedDictionary, NestedDictionaryStructure],
})
export class NestedDictionaryModule {}
