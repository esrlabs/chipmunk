import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DialogMonitorManager                   } from './component';
import { DialogMonitorManagerSettingTab         } from './settings/component';
import { DialogMonitorManagerLogsTab            } from './logs/component';
import { Components as ComponentsCommmon        } from '../../../common/components';



@NgModule({
    entryComponents : [ DialogMonitorManager, DialogMonitorManagerSettingTab, DialogMonitorManagerLogsTab ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ DialogMonitorManager, DialogMonitorManagerSettingTab, DialogMonitorManagerLogsTab ],
    exports         : [ DialogMonitorManager, DialogMonitorManagerSettingTab, DialogMonitorManagerLogsTab ]
})

export class DialogMonitorManagerModule {
    constructor(){
    }
}