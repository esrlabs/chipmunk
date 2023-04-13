import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { InputFilter } from './component';

const components = [InputFilter];
@NgModule({
    imports: [CommonModule, MatFormFieldModule, MatInputModule, FormsModule, ReactiveFormsModule],
    declarations: [...components],
    exports: [...components]
})
export class FilterInputModule {}
