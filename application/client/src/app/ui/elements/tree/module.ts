import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTreeModule } from '@angular/material/tree';
import { CdkTreeModule } from '@angular/cdk/tree';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FilterInputModule } from '@elements/filter/module';

import { ElementsTreeSelector } from './component';

import { InputListenerDirective } from '@ui/env/directives/input';

@NgModule({
    imports: [
        CommonModule,
        MatTreeModule,
        CdkTreeModule,
        MatProgressBarModule,
        MatButtonModule,
        MatIconModule,
        FilterInputModule,
    ],
    declarations: [ElementsTreeSelector, InputListenerDirective],
    exports: [ElementsTreeSelector],
    bootstrap: [ElementsTreeSelector],
})
export class TreeModule {}
