import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';

import { SettingsScheme } from './component';
import { SchemeEntry } from './entry/component';
import { SchemeEntryBound } from './bound/component';
import { SchemeEntryElement } from './inner/component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatCheckboxModule,
        MatCardModule,
        MatDividerModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
    ],
    declarations: [SettingsScheme, SchemeEntry, SchemeEntryBound, SchemeEntryElement],
    exports: [SettingsScheme],
    bootstrap: [SettingsScheme, SchemeEntry, SchemeEntryBound, SchemeEntryElement],
})
export class SettingsSchemeModule {}
