import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { TabAboutModule                         } from './about/module';

const components = [  ];

@NgModule({
    entryComponents : [ ...components ],
    imports         : [ CommonModule ],
    declarations    : [ ...components ],
    exports         : [ TabAboutModule, ...components ]
})

export class EnvironmentTabsModule {
    constructor() {
    }
}
