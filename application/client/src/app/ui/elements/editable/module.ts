import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Field } from './component';

@NgModule({
    imports: [CommonModule, MatInputModule, FormsModule, ReactiveFormsModule],
    declarations: [Field],
    exports: [Field],
})
export class EditableModule {}
