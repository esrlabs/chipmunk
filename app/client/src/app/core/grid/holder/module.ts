import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { Holder                                 } from '../../components/holder/layout/component';
import { View                                   } from '../../components/holder/view/component';
import { ViewBar                                } from '../../components/holder/view-bar/component';
import { Components as ComponentsCommmon        } from '../../components/common/components';

import { DynamicComponent                       } from '../../../views/controllers';

import { ViewListModule                         } from '../../../views/list/module';
import { ViewSearchResultsModule                } from '../../../views/search.results/module';
import { ViewChartModule                        } from '../../../views/chart/module';
import { ViewStateMonitorModule                 } from '../../../views/statemonitor/module';
import { ViewStreamSenderModule                 } from '../../../views/streamsender/module';
import { ViewMarkersModule                      } from '../../../views/markers/module';
import { DialogMonitorManagerModule             } from '../../components/common/dialogs/monitor.manager/module';


@NgModule({
    entryComponents : [  ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ Holder, View, ViewBar, DynamicComponent ],
    exports         : [ Holder, View, ViewBar, ViewListModule, ViewSearchResultsModule, ViewChartModule, ViewStateMonitorModule, ViewStreamSenderModule, ViewMarkersModule, DialogMonitorManagerModule ]
})

export class HolderModule {
    constructor(){
    }
}