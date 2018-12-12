import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ViewControllerQuickChart               } from './component';
import { ViewControllerQuickchartChart          } from './chart/component';
import { ViewControllerQuickchartBar            } from './topbar/component';
import { ViewControllerQuickchartList           } from './list/component';

import { Components as ComponentsCommmon        } from '../../core/components/common/components';



@NgModule({
    entryComponents : [ ViewControllerQuickchartChart, ViewControllerQuickchartBar, ViewControllerQuickchartList ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ ViewControllerQuickChart, ViewControllerQuickchartChart, ViewControllerQuickchartBar, ViewControllerQuickchartList ],
    exports         : [ ViewControllerQuickChart, ViewControllerQuickchartChart, ViewControllerQuickchartBar, ViewControllerQuickchartList ]
})

export class ViewQuickChartModule {
    constructor(){
    }
}