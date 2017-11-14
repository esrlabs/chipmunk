import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ViewControllerList                     } from './component';
import { ViewControllerListItem                 } from './item/component';
import { ViewControllerListLine                 } from './line/component';
import { Components as ComponentsCommmon        } from '../../core/components/common/components';



@NgModule({
    entryComponents : [ ViewControllerListItem ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ ViewControllerList, ViewControllerListItem, ViewControllerListLine ],
    exports         : [ ViewControllerList, ViewControllerListItem, ViewControllerListLine ]
})

export class ViewListModule {
    constructor(){
    }
}