import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewSearch } from './component';
import { ViewSearchInput } from './input/component';
import { ViewSearchResults } from './results/component';
import { ScrollAreaModule } from '@elements/scrollarea/module';
import { ContainersModule } from '@elements/containers/module';
import { AppDirectiviesModule } from '@directives/module';

import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const entryComponents = [ViewSearch, ViewSearchInput, ViewSearchResults];
const components = [ViewSearch, ...entryComponents];

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        ScrollAreaModule,
        AppDirectiviesModule,
        MatIconModule,
        MatAutocompleteModule,
        MatOptionModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        FormsModule,
        ReactiveFormsModule,
    ],
    declarations: [...components],
    exports: [...components, ScrollAreaModule]
})
export class SearchModule {}
