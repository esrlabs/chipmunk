import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ViewControllerChart                    } from './component';
import { ViewControllerTabChart                 } from './tab.chart/component';
import { ViewControllerTabChartManager          } from './tab.manager/component';
import { ViewControllerTabChartManagerSet       } from './tab.manager/chart.set/component';

import { Components as ComponentsCommmon        } from '../../core/components/common/components';



@NgModule({
    entryComponents : [ ViewControllerTabChart, ViewControllerTabChartManager, ViewControllerTabChartManagerSet ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ ViewControllerChart, ViewControllerTabChart, ViewControllerTabChartManager, ViewControllerTabChartManagerSet ],
    exports         : [ ViewControllerChart, ViewControllerTabChart, ViewControllerTabChartManager, ViewControllerTabChartManagerSet ]
})

export class ViewChartModule {
    constructor(){
    }
}