import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTreeModule } from '@angular/material/tree';
import { CdkTreeModule } from '@angular/cdk/tree';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FilterInputModule } from '@elements/filter/module';

import { ElementsTreeSelector } from './component';

import { InputListenerDirective } from '@ui/env/directives/input';

const components = [ElementsTreeSelector, InputListenerDirective];

@NgModule({
    imports: [
        CommonModule,
        MatTreeModule,
        CdkTreeModule,
        MatProgressBarModule,
        MatButtonModule,
        MatIconModule,
        FilterInputModule,
        MatProgressSpinnerModule,
    ],
    declarations: [...components],
    exports: [...components]
})
export class TreeModule {}
