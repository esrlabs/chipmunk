import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { TabAboutModule                         } from './about/module';
import { TabPluginsModule                       } from './plugins/module';
import { TabSettingsModule                      } from './settings/module';

const components = [  ];

@NgModule({
    entryComponents : [ ...components ],
    imports         : [ CommonModule ],
    declarations    : [ ...components ],
    exports         : [ TabAboutModule, TabPluginsModule, TabSettingsModule, ...components ]
})

export class EnvironmentTabsModule {
    constructor() {
    }
}
