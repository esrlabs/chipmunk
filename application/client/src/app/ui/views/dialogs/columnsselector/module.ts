import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColumnsSelector } from './component';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';

@NgModule({
    imports: [
        CommonModule,
        MatButtonModule,
        MatCheckboxModule,
        FormsModule,
        ReactiveFormsModule,
        MatInputModule,
    ],
    declarations: [ColumnsSelector],
    exports: [ColumnsSelector],
    bootstrap: [ColumnsSelector],
})
export class ColumnsSelectorModule {}
