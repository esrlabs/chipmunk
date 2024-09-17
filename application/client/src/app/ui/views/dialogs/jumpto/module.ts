import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JumpTo } from './component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
    imports: [CommonModule, MatFormFieldModule, MatInputModule, FormsModule, ReactiveFormsModule],
    declarations: [JumpTo],
    exports: [JumpTo],
    bootstrap: [JumpTo],
})
export class JumpToModule {}
