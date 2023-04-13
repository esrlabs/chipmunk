import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';

import { AutocompleteInput } from './component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatAutocompleteModule,
        MatOptionModule,
    ],
    declarations: [AutocompleteInput],
    exports: [AutocompleteInput]
})
export class AutocompleteModule {}
