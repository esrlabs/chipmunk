import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ViewLoaderComponent                    } from './loader/component';
import { ViewOutputModule                       } from './output/module';
import { ViewSearchModule                       } from './search/module';
import { ViewChartModule                        } from './chart/module';

const components = [ ViewLoaderComponent ];

@NgModule({
    entryComponents : [ ...components ],
    imports         : [ CommonModule ],
    declarations    : [ ...components ],
    exports         : [ ViewOutputModule, ViewSearchModule, ViewChartModule, ...components ]
})

export class EnvironmentViewsModule {
    constructor() {
    }
}
