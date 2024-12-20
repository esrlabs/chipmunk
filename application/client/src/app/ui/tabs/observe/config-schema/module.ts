import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';

import { ConfigSchemas } from './component';
import { ConfgiSchemaEntry } from './entry/component';
import { ConfigSchemaBool } from './renders/bool/component';
import { ConfigSchemaString } from './renders/string/component';

const components = [ConfigSchemas, ConfgiSchemaEntry, ConfigSchemaBool, ConfigSchemaString];

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
    ],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components],
})
export class ConfigSchmasModule {}
