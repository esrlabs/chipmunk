import { NgModule                                   } from '@angular/core';
import { CommonModule                               } from '@angular/common';

import { ViewChartComponent                         } from './component';
import { ViewChartCanvasComponent                   } from './chart/component';
import { ViewChartZoomerCanvasComponent             } from './zoomer/component';
import { ViewChartZoomerCursorCanvasComponent       } from './zoomer/cursor/component';
import { PrimitiveModule, ContainersModule          } from 'chipmunk-client-material';

const entryComponents = [ ViewChartComponent, ViewChartCanvasComponent, ViewChartZoomerCanvasComponent, ViewChartZoomerCursorCanvasComponent ];
const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ViewChartModule {
    constructor() {
    }
}
