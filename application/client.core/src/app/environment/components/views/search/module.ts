import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { ViewSearchComponent } from './component';
import { ViewSearchOutputComponent } from './output/component';
import { ViewSearchControlsComponent } from './output/controls/component';

import { ComplexModule, PrimitiveModule, ContainersModule } from 'chipmunk-client-material';
import { AppDirectiviesModule } from '../../../directives/module';

import { MatIconModule } from '@angular/material/icon';
import { MatAutocomplete, MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { MatFormField, MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const entryComponents = [
    ViewSearchComponent,
    ViewSearchOutputComponent,
    ViewSearchControlsComponent,
    MatFormField,
    MatAutocomplete,
];
const components = [
    ViewSearchComponent,
    ViewSearchComponent,
    ViewSearchOutputComponent,
    ViewSearchControlsComponent,
];

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
        MatInputModule,
        MatAutocompleteModule,
        MatOptionModule,
        AppDirectiviesModule,
        MatProgressBarModule,
        MatIconModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class ViewSearchModule {
    constructor() {}
}
