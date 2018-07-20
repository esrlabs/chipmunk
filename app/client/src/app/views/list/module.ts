import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ViewControllerList                     } from './component';
import { ViewControllerListItem                 } from './item/component';
import { ViewControllerListLine                 } from './line/component';
import { ViewControllerListFullLine             } from './full-line/component';

import { Components as ComponentsCommmon        } from '../../core/components/common/components';



@NgModule({
    entryComponents : [ ViewControllerListItem ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ ViewControllerList, ViewControllerListItem, ViewControllerListLine, ViewControllerListFullLine ],
    exports         : [ ViewControllerList, ViewControllerListItem, ViewControllerListLine, ViewControllerListFullLine ]
})

export class ViewListModule {
    constructor(){
    }
}