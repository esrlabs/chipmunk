import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ViewControllerSearchResults            } from './component';
import { TabControllerSearchRequests            } from './tab.requests/component';
import { ViewRequestItem                        } from './tab.requests/request/component';
import { TabControllerSearchResults             } from './tab.results/component';
import { Components as ComponentsCommmon        } from '../../core/components/common/components';



@NgModule({
    entryComponents : [ TabControllerSearchRequests, TabControllerSearchResults, ViewRequestItem ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ ViewControllerSearchResults, TabControllerSearchRequests, TabControllerSearchResults, ViewRequestItem ],
    exports         : [ ViewControllerSearchResults, TabControllerSearchRequests, TabControllerSearchResults, ViewRequestItem ]
})

export class ViewSearchResultsModule {
    constructor(){
    }
}