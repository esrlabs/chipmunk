import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { ConfigSchmasModule } from '@ui/tabs/observe/config-schema/module';
import { ParserPluginGeneralConfiguration } from './component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatChipsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatListModule,
        ConfigSchmasModule,
        MatCheckboxModule,
        MatInputModule,
    ],
    declarations: [ParserPluginGeneralConfiguration],
    exports: [ParserPluginGeneralConfiguration],
    bootstrap: [ParserPluginGeneralConfiguration],
})
export class ParserPluginGeneralConfigurationModule {}
