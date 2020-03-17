import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';
import { AppDirectiviesModule                   } from '../../../directives/module';
import { DragDropModule                         } from '@angular/cdk/drag-drop';
import { EnvironmentCommonModule                } from '../../common/module';

import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule, MatSlider } from '@angular/material/slider';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';

import { SidebarAppSearchManagerChartsComponent         } from './charts/component';
import { SidebarAppSearchManagerFiltersComponent        } from './filters/component';
import { SidebarAppSearchManagerChartComponent          } from './chart/component';
import { SidebarAppSearchManagerFilterComponent         } from './filter/component';
import { SidebarAppSearchManagerChartDetailsComponent   } from './chart.details/component';
import { SidebarAppSearchManagerFilterDetailsComponent  } from './filter.details/component';
import { SidebarAppSearchManagerComponent               } from './component';
import { SidebarAppSearchManagerItemDirective           } from './directives/item.directive';
import { SidebarAppSearchManagerControlsComponent       } from './manager/component';

const entryComponents = [
    SidebarAppSearchManagerComponent,
    SidebarAppSearchManagerChartsComponent,
    SidebarAppSearchManagerFiltersComponent,
    SidebarAppSearchManagerChartComponent,
    SidebarAppSearchManagerFilterComponent,
    SidebarAppSearchManagerChartDetailsComponent,
    SidebarAppSearchManagerFilterDetailsComponent,
    SidebarAppSearchManagerControlsComponent,
];
const components = [ ...entryComponents ];
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
    AppDirectiviesModule,
    MatExpansionModule,
    MatSliderModule,
    DragDropModule,
    EnvironmentCommonModule
];

@NgModule({
    entryComponents : [ ...entryComponents, MatSlider ],
    imports         : [ ...modules ],
    declarations    : [ ...components, SidebarAppSearchManagerItemDirective ],
    exports         : [ ...components, SidebarAppSearchManagerItemDirective ]
})

export class SidebarAppSearchManagerModule {
    constructor() {
    }
}
