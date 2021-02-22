import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';
import { AppDirectiviesModule                   } from '../../../directives/module';
import { EnvironmentCommonModule                } from '../../common/module';

import { SidebarAppCommandComponent             } from './component';

import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule, MatSlider } from '@angular/material/slider';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';

const entryComponents = [
    SidebarAppCommandComponent,
];

const modules = [
    CommonModule,
    PrimitiveModule,
    ContainersModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    MatOptionModule,
    MatSortModule,
    MatTableModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatButtonModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    AppDirectiviesModule,
    MatExpansionModule,
    MatSliderModule,
    MatIconModule,
    MatTooltipModule,
    EnvironmentCommonModule
];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ ...modules ],
    declarations    : [ ...entryComponents ],
    exports         : [ ...entryComponents ]
})

export class SidebarAppCommandModule {
    constructor() {
    }
}
