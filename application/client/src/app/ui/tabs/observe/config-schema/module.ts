import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';

import { ConfigSchemas } from './component';
import { ConfgiSchemaEntry } from './entry/component';
import { ConfigSchemaBool } from './renders/bool/component';
import { ConfigSchemaInteger } from './renders/integer/component';
import { ConfigSchemaFloat } from './renders/float/component';
import { ConfigSchemaString } from './renders/string/component';
import { ConfigSchemaDropdown } from './renders/dropdown/component';

const components = [
    ConfigSchemas,
    ConfgiSchemaEntry,
    ConfigSchemaBool,
    ConfigSchemaInteger,
    ConfigSchemaFloat,
    ConfigSchemaString,
    ConfigSchemaDropdown,
];

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatCheckboxModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
    ],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components],
})
export class ConfigSchmasModule {}
