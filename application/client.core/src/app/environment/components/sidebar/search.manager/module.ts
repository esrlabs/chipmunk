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
import { MatIconModule } from '@angular/material/icon';
import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';

import { SidebarAppSearchManagerChartsComponent             } from './charts/list/component';
import { SidebarAppSearchManagerFiltersComponent            } from './filters/list/component';
import { SidebarAppSearchManagerChartComponent              } from './charts/chart/component';
import { SidebarAppSearchManagerFilterComponent             } from './filters/filter/component';
import { SidebarAppSearchManagerChartDetailsComponent       } from './charts/details/component';
import { SidebarAppSearchManagerFilterDetailsComponent      } from './filters/details/component';
import { SidebarAppSearchManagerTimeRangeComponent          } from './ranges/range/component';
import { SidebarAppSearchManagerTimeRangesComponent         } from './ranges/list/component';
import { SidebarAppSearchManagerFilterMiniComponent         } from './ranges/filter/component';
import { SidebarAppSearchManagerComponent                   } from './component';
import { SidebarAppSearchManagerItemDirective               } from './directives/item.directive';
import { SidebarAppSearchManagerControlsComponent           } from './controls/component';
import { SidebarAppSearchManagerTimerangeDetailsComponent   } from './ranges/details/component';

const entryComponents = [
    SidebarAppSearchManagerComponent,
    SidebarAppSearchManagerChartsComponent,
    SidebarAppSearchManagerFiltersComponent,
    SidebarAppSearchManagerChartComponent,
    SidebarAppSearchManagerFilterComponent,
    SidebarAppSearchManagerChartDetailsComponent,
    SidebarAppSearchManagerFilterDetailsComponent,
    SidebarAppSearchManagerControlsComponent,
    SidebarAppSearchManagerTimeRangeComponent,
    SidebarAppSearchManagerTimeRangesComponent,
    SidebarAppSearchManagerTimerangeDetailsComponent,
    SidebarAppSearchManagerFilterMiniComponent,
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
    MatIconModule,
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
