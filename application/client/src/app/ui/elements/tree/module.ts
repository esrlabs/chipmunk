import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElementsTreeSelector } from './component';
import { MatTreeModule } from '@angular/material/tree';
import { CdkTreeModule } from '@angular/cdk/tree';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@NgModule({
    entryComponents: [ElementsTreeSelector],
    imports: [
        CommonModule,
        MatTreeModule,
        CdkTreeModule,
        MatProgressBarModule,
        MatButtonModule,
        MatIconModule,
    ],
    declarations: [ElementsTreeSelector],
    exports: [ElementsTreeSelector],
})
export class TreeModule {
    constructor() {}
}
