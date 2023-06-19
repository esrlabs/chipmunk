import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { AppDirectiviesModule } from '@ui/env/directives/module';
import { MatSortModule } from '@angular/material/sort';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { HiddenFilterModule } from '@elements/filter.hidden/module';

import { TabSourceMultipleFilesStructure } from './structure/component';
import { TabSourceMultipleFiles } from './component';

const components = [TabSourceMultipleFiles, TabSourceMultipleFilesStructure];
const imports = [
    MatButtonModule,
    MatCardModule,
    MatTableModule,
    AppDirectiviesModule,
    MatSortModule,
    CommonModule,
    DragDropModule,
    HiddenFilterModule,
];

@NgModule({
    imports: [...imports],
    declarations: [...components],
    exports: [...components],
})
export class MultipleFilesModule {}
