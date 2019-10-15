import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DialogsFileOptionsDltComponent         } from './file.options.dlt/component';
import { DialogsHotkeysMapComponent             } from './hotkeys/component';
import { DialogsMultipleFilesActionComponent    } from './multiplefiles/component';
import { DialogsRecentFilesActionComponent      } from './recentfile/component';
import { DialogsRecentFitlersActionComponent    } from './recentfilter/component';
import { DialogsChartsNewActionComponent        } from './charts.new/component';

import { PrimitiveModule                        } from 'logviewer-client-primitive';
import { ContainersModule                       } from 'logviewer-client-containers';

const CDialogs = [
    DialogsFileOptionsDltComponent,
    DialogsHotkeysMapComponent,
    DialogsMultipleFilesActionComponent,
    DialogsRecentFilesActionComponent,
    DialogsRecentFitlersActionComponent,
    DialogsChartsNewActionComponent
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
