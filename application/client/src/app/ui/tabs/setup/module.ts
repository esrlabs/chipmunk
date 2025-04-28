import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { SettingsSchemeModule } from '@elements/scheme/module';
import { SetupObserve } from './component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        SettingsSchemeModule,
    ],
    declarations: [SetupObserve],
    exports: [SetupObserve],
    bootstrap: [SetupObserve],
})
export class SetupModule {}
