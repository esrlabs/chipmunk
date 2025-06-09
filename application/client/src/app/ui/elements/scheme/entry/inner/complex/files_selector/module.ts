import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatIcon } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';

import { FilesSelector } from './component';

@NgModule({
    imports: [
        CommonModule,
        MatButtonModule,
        MatChipsModule,
        MatSelectModule,
        MatListModule,
        MatIcon,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
    ],
    declarations: [FilesSelector],
    exports: [FilesSelector],
    bootstrap: [FilesSelector],
})
export class FilesSelectorModule {}
