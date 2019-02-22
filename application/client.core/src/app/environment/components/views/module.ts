import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ViewLoaderComponent                    } from './loader/component';
import { ViewOutputModule                       } from './output/module';

const components = [ ViewLoaderComponent ];

@NgModule({
    entryComponents : [ ...components ],
    imports         : [ CommonModule ],
    declarations    : [ ...components ],
    exports         : [ ViewOutputModule, ...components ]
})

export class EnvironmentViewsModule {
    constructor() {
    }
}
