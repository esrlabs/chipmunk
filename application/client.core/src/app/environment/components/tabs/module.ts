import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { TabAboutModule                         } from './about/module';
import { TabPluginsModule                       } from './plugins/module';
import { TabSettingsModule                      } from './settings/module';
import { TabReleaseNotesModule                  } from './release.notes/module';

const components = [  ];

@NgModule({
    entryComponents : [ ...components ],
    imports         : [ CommonModule ],
    declarations    : [ ...components ],
    exports         : [ TabAboutModule, TabPluginsModule, TabSettingsModule, TabReleaseNotesModule, ...components ]
})

export class EnvironmentTabsModule {
    constructor() {
    }
}
