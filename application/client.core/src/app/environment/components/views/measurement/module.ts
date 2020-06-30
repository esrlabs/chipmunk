import { NgModule                                   } from '@angular/core';
import { CommonModule                               } from '@angular/common';
import { ScrollingModule                            } from '@angular/cdk/scrolling';

import { ViewMeasurementComponent                   } from './component';
import { ViewMeasurementFormatsComponent            } from './formats/component';
import { ViewMeasurementFormatComponent             } from './format/component';
import { ViewMeasurementDefaultsComponent           } from './defaults/component';
import { ViewMeasurementChartComponent              } from './charts/component';
import { ViewMeasurementOverviewComponent           } from './overview/component';
import { PrimitiveModule, ContainersModule          } from 'chipmunk-client-material';
import { MatButtonModule                            } from '@angular/material/button';
import { MatIconModule                              } from '@angular/material/icon';
import { MatInputModule                             } from '@angular/material/input';
import { MatFormFieldModule                         } from '@angular/material/form-field';
import { MatProgressBarModule                       } from '@angular/material/progress-bar';
import { MatExpansionModule                         } from '@angular/material/expansion';

import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';
const entryComponents = [
    ViewMeasurementComponent,
    ViewMeasurementFormatsComponent,
    ViewMeasurementFormatComponent,
    ViewMeasurementDefaultsComponent,
    ViewMeasurementChartComponent,
    ViewMeasurementOverviewComponent,
];

const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [
        CommonModule,
        PrimitiveModule,
        ContainersModule,
        ScrollingModule,
        MatButtonModule,
        MatInputModule,
        MatIconModule,
        MatFormFieldModule,
        MatProgressBarModule,
        MatExpansionModule,
        FormsModule,
        ReactiveFormsModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ViewMeasurementModule {
    constructor() {
    }
}
