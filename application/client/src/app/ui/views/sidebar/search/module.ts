import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { AppDirectiviesModule } from '@directives/module';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ComColorSelectorComponent } from '@ui/elements/color.selector/component';
import { Filters } from './component';

import { FilterDetails } from './filters/details/component';
import { Filter } from './filters/filter/component';
import { FiltersList } from './filters/list/component';
import { FiltersPlaceholder } from './filters/placeholder/component';

import { Disabled } from './disabled/entity/component';
import { DisabledList } from './disabled/list/component';

const entryComponents = [
    Filters,
    FilterDetails,
    Filter,
    FiltersList,
    FiltersPlaceholder,
    Disabled,
    DisabledList,
    ComColorSelectorComponent,
];
const components = [...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
        CommonModule,
        ContainersModule,
        AppDirectiviesModule,
        MatIconModule,
        MatAutocompleteModule,
        MatOptionModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatCheckboxModule,
        FormsModule,
        ReactiveFormsModule,
        DragDropModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class FiltersModule {
    constructor() {}
}
