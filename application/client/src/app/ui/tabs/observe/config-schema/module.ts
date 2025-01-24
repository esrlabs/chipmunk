import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { ConfigSchemas } from './component';
import { ConfgiSchemaEntry } from './entry/component';
import { ConfigSchemaBool } from './renders/bool/component';
import { ConfigSchemaInteger } from './renders/integer/component';
import { ConfigSchemaFloat } from './renders/float/component';
import { ConfigSchemaString } from './renders/string/component';
import { ConfigSchemaDropdown } from './renders/dropdown/component';
import { ConfigSchemaFiles } from './renders/files/component';
import { ConfigSchemaDirs } from './renders/dirs/component';

const components = [
    ConfigSchemas,
    ConfgiSchemaEntry,
    ConfigSchemaBool,
    ConfigSchemaInteger,
    ConfigSchemaFloat,
    ConfigSchemaString,
    ConfigSchemaDropdown,
    ConfigSchemaFiles,
    ConfigSchemaDirs,
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
        MatChipsModule,
        MatIconModule,
        MatDividerModule,
    ],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components],
})
export class ConfigSchmasModule {}
