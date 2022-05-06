import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { TabAboutComponent } from './component';

import { ComplexModule, PrimitiveModule, ContainersModule } from 'chipmunk-client-material';

import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormField, MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const entryComponents = [TabAboutComponent, MatFormField];
const components = [TabAboutComponent];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
        CommonModule,
        ScrollingModule,
        PrimitiveModule,
        ContainersModule,
        ComplexModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        MatExpansionModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class TabAboutModule {
    constructor() {}
}
