import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { NotificationsComponent                 } from './component';
import { NotificationComponent                  } from './notification/component';

import { PrimitiveModule                        } from 'logviewer-client-primitive';
import { ContainersModule                       } from 'logviewer-client-containers';

const entryComponents = [ NotificationComponent ];
const components = [ NotificationsComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class NotificationsModule {
    constructor() {
    }
}
