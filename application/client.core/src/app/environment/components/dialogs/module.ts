import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DialogsFileOptionsDltComponent         } from './file.options.dlt/component';

import { PrimitiveModule                        } from 'logviewer-client-primitive';
import { ContainersModule                       } from 'logviewer-client-containers';

const CDialogs = [ DialogsFileOptionsDltComponent ];

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
