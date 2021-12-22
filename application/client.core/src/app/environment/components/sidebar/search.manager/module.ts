import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimitiveModule, ContainersModule } from 'chipmunk-client-material';
import { AppDirectiviesModule } from '../../../directives/module';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { EnvironmentCommonModule } from '../../common/module';

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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { SidebarAppSearchManagerChartsComponent } from './charts/list/component';
import { SidebarAppSearchManagerChartComponent } from './charts/chart/component';
import { SidebarAppSearchManagerChartDetailsComponent } from './charts/details/component';
import { SidebarAppSearchManagerFiltersComponent } from './filters/list/component';
import { SidebarAppSearchManagerFilterComponent } from './filters/filter/component';
import { SidebarAppSearchManagerFiltersPlaceholderComponent } from './filters/placeholder/component';
import { SidebarAppSearchManagerFilterDetailsComponent } from './filters/details/component';
import { SidebarAppSearchManagerTimeRangeComponent } from './ranges/range/component';
import { SidebarAppSearchManagerTimeRangesComponent } from './ranges/list/component';
import { SidebarAppSearchManagerFilterMiniComponent } from './ranges/filter/component';
import { SidebarAppSearchManagerTimerangeDetailsComponent } from './ranges/details/component';
import { SidebarAppSearchManagerDisabledsComponent } from './disabled/list/component';
import { SidebarAppSearchManagerDisabledComponent } from './disabled/entity/component';
import { SidebarAppSearchManagerComponent } from './component';
import { SidebarAppSearchManagerItemDirective } from './directives/item.directive';
import { SidebarAppSearchManagerListDirective } from './directives/list.directive';
import { SidebarAppSearchManagerControlsComponent } from './controls/component';
import { SidebarAppSearchManagerBinComponent } from './bin/component';

const entryComponents = [
    SidebarAppSearchManagerComponent,
    SidebarAppSearchManagerChartsComponent,
    SidebarAppSearchManagerFiltersComponent,
    SidebarAppSearchManagerChartComponent,
    SidebarAppSearchManagerFilterComponent,
    SidebarAppSearchManagerFiltersPlaceholderComponent,
    SidebarAppSearchManagerChartDetailsComponent,
    SidebarAppSearchManagerFilterDetailsComponent,
    SidebarAppSearchManagerControlsComponent,
    SidebarAppSearchManagerTimeRangeComponent,
    SidebarAppSearchManagerTimeRangesComponent,
    SidebarAppSearchManagerTimerangeDetailsComponent,
    SidebarAppSearchManagerFilterMiniComponent,
    SidebarAppSearchManagerDisabledsComponent,
    SidebarAppSearchManagerDisabledComponent,
    SidebarAppSearchManagerBinComponent,
];
const components = [...entryComponents];
const directives = [SidebarAppSearchManagerItemDirective, SidebarAppSearchManagerListDirective];
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
    DragDropModule,
    EnvironmentCommonModule,
    MatMenuModule,
    MatDividerModule,
];

@NgModule({
    entryComponents: [...entryComponents, MatSlider],
    imports: [...modules],
    declarations: [...components, ...directives],
    exports: [...components, ...directives],
})
export class SidebarAppSearchManagerModule {
    constructor() {}
}
