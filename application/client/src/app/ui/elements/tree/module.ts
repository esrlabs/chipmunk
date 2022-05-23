import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTreeModule } from '@angular/material/tree';
import { CdkTreeModule } from '@angular/cdk/tree';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ElementsTreeSelector } from './component';
import { ElementsTreeSelectorInput } from './input/component';

@NgModule({
    entryComponents: [ElementsTreeSelector, ElementsTreeSelectorInput],
    imports: [
        CommonModule,
        MatTreeModule,
        CdkTreeModule,
        MatProgressBarModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        FormsModule,
        ReactiveFormsModule,
    ],
    declarations: [ElementsTreeSelector, ElementsTreeSelectorInput],
    exports: [ElementsTreeSelector, ElementsTreeSelectorInput],
})
export class TreeModule {
    constructor() {}
}
