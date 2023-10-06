import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';

import { Settings } from './component';
import { SettingsNode } from './node/component';
import { SettingsEntry } from './entry/component';
import { SettingsEntryString } from './renders/string/component';
import { SettingsEntryBool } from './renders/bool/component';
import { SettingsEntryColor } from './renders/color/component';

const components = [
    Settings,
    SettingsNode,
    SettingsEntry,
    SettingsEntryString,
    SettingsEntryBool,
    SettingsEntryColor,
];

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
    ],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components],
})
export class SettingsModule {}
