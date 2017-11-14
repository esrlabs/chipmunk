import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ViewControllerStateMonitorMain         } from './component';
import { ViewControllerStateMonitor             } from './statemonitor.monitor/component';
import { ViewControllerStateMonitorItem         } from './statemonitor.monitor/item/component';
import { ViewControllerStateMonitorManager      } from './statemonitor.manager/component';
import { ViewControllerStateManagerItem         } from './statemonitor.manager/item/component';

import { Components as ComponentsCommmon        } from '../../core/components/common/components';



@NgModule({
    entryComponents : [ ViewControllerStateMonitorMain, ViewControllerStateMonitor, ViewControllerStateMonitorItem, ViewControllerStateMonitorManager, ViewControllerStateManagerItem ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ ViewControllerStateMonitorMain, ViewControllerStateMonitor, ViewControllerStateMonitorItem, ViewControllerStateMonitorManager, ViewControllerStateManagerItem ],
    exports         : [ ViewControllerStateMonitorMain, ViewControllerStateMonitor, ViewControllerStateMonitorItem, ViewControllerStateMonitorManager, ViewControllerStateManagerItem ]
})

export class ViewStateMonitorModule {
    constructor(){
    }
}