import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ViewControllerList                     } from './component';
import { ViewControllerListItem                 } from './item/component';
import { ViewControllerListLine                 } from './line/component';
import { ViewControllerListFullLine             } from './full-line/component';
import { ViewControllerListRemarks              } from './remarks/component';

import { Components as ComponentsCommon         } from '../../core/components/common/components';



@NgModule({
    entryComponents : [ ViewControllerListItem ],
    imports         : [ CommonModule, ComponentsCommon ],
    declarations    : [ ViewControllerList, ViewControllerListItem, ViewControllerListLine, ViewControllerListFullLine, ViewControllerListRemarks ],
    exports         : [ ViewControllerList, ViewControllerListItem, ViewControllerListLine, ViewControllerListFullLine, ViewControllerListRemarks ]
})

export class ViewListModule {
    constructor(){
    }
}