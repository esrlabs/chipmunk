import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DialogsFileOptionsDltComponent         } from './file.options.dlt/component';
import { DialogsHotkeysMapComponent             } from './hotkeys/component';
import { DialogsMultipleFilesActionComponent    } from './multiplefiles/component';
import { DialogsRecentFilesActionComponent      } from './recentfile/component';
import { DialogsRecentFitlersActionComponent    } from './recentfilter/component';

import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';

const CDialogs = [
    DialogsFileOptionsDltComponent,
    DialogsHotkeysMapComponent,
    DialogsMultipleFilesActionComponent,
    DialogsRecentFilesActionComponent,
    DialogsRecentFitlersActionComponent
];

@NgModule({
    entryComponents : [ ...CDialogs ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...CDialogs ],
    exports         : [ ...CDialogs ]
})

export class EnvironmentDialogsModule {
    constructor() {
    }
}
