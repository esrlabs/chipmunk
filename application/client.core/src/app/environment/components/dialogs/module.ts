import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DialogsFileOptionsDltComponent         } from './file.options.dlt/component';
import { DialogsHotkeysMapComponent             } from './hotkeys/component';
import { DialogsMultipleFilesActionComponent    } from './multiplefiles/component';
import { DialogsRecentFilesActionComponent      } from './recentfile/component';
import { DialogsRecentFitlersActionComponent    } from './recentfilter/component';

import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';
import { AppDirectiviesModule                   } from '../../directives/module';

import {
    MatFormField,
    MatAutocomplete,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatOptionModule } from '@angular/material';
import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';

const entryComponents = [MatFormField, MatAutocomplete];

const CDialogs = [
    DialogsFileOptionsDltComponent,
    DialogsHotkeysMapComponent,
    DialogsMultipleFilesActionComponent,
    DialogsRecentFilesActionComponent,
    DialogsRecentFitlersActionComponent
];

@NgModule({
    entryComponents : [ ...CDialogs, ...entryComponents ],
    imports         : [
        CommonModule,
        PrimitiveModule,
        ContainersModule,
        FormsModule,
        ReactiveFormsModule,
        MatInputModule,
        MatFormFieldModule,
        MatAutocompleteModule,
        MatOptionModule,
        AppDirectiviesModule
    ],
    declarations    : [ ...CDialogs ],
    exports         : [ ...CDialogs ],
})

export class EnvironmentDialogsModule {
    constructor() {
    }
}
