import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { NotificationsComponent                 } from './component';
import { NotificationComponent                  } from './notification/component';

import { EnvironmentSupportModule               } from '../../support/module';
import { EnvironmentControlsModule              } from '../../controls/module';

const entryComponents = [ NotificationComponent ];
const components = [ NotificationsComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, EnvironmentSupportModule, EnvironmentControlsModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class NotificationsModule {
    constructor() {
    }
}
