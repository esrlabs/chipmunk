import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ViewLoaderComponent                    } from './loader/component';
import { ViewOutputModule                       } from './output/module';
import { ViewSearchModule                       } from './search/module';

const components = [ ViewLoaderComponent ];

@NgModule({
    entryComponents : [ ...components ],
    imports         : [ CommonModule ],
    declarations    : [ ...components ],
    exports         : [ ViewOutputModule, ViewSearchModule, ...components ]
})

export class EnvironmentViewsModule {
    constructor() {
    }
}
