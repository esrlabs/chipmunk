import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Field } from './component';

const components = [Field];
@NgModule({
    imports: [CommonModule, MatInputModule, FormsModule, ReactiveFormsModule],
    declarations: [...components],
    exports: [...components]
})
export class EditableModule {}
