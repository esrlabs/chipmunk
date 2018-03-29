import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { Holder                                 } from '../../components/holder/layout/component';
import { View                                   } from '../../components/holder/view/component';
import { ViewBar                                } from '../../components/holder/view-bar/component';
import { ContextMenu                            } from '../../components/context-menu/component';
import { Components as ComponentsCommmon        } from '../../components/common/components';

import { DynamicComponent                       } from '../../../views/controllers';

import { ViewListModule                         } from '../../../views/list/module';
import { ViewSearchResultsModule                } from '../../../views/search.results/module';
import { ViewChartModule                        } from '../../../views/chart/module';
import { ViewStateMonitorModule                 } from '../../../views/statemonitor/module';
import { ViewStreamSenderModule                 } from '../../../views/streamsender/module';
import { ViewMarkersModule                      } from '../../../views/markers/module';
import { DialogMonitorManagerModule             } from '../../components/common/dialogs/monitor.manager/module';
import { DialogSettingsModule                   } from '../../components/common/dialogs/app.settings/module';
import { DialogMarkersManagerModule             } from '../../components/common/dialogs/markers.manager/module';


@NgModule({
    entryComponents : [  ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ Holder, View, ViewBar, ContextMenu, DynamicComponent ],
    exports         : [ Holder, View, ViewBar, ContextMenu, ViewListModule, ViewSearchResultsModule, ViewChartModule, ViewStateMonitorModule, ViewStreamSenderModule, ViewMarkersModule, DialogMonitorManagerModule, DialogSettingsModule, DialogMarkersManagerModule ]
})

export class HolderModule {
    constructor(){
    }
}