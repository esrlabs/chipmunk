import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { AppDirectiviesModule } from '@ui/env/directives/module';
import { MatSortModule } from '@angular/material/sort';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { TabSourceMultipleFilesStructure } from './structure/component';
import { TabSourceMultipleFiles } from './component';

const components = [TabSourceMultipleFiles, TabSourceMultipleFilesStructure];
const imports = [
    MatButtonModule,
    MatCardModule,
    MatTableModule,
    AppDirectiviesModule,
    MatSortModule,
    FormsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    CommonModule,
];

@NgModule({
    entryComponents: [...components],
    imports: [...imports],
    declarations: [...components],
    exports: [...components],
})
export class TabSourceMultipleFilesModule {}
