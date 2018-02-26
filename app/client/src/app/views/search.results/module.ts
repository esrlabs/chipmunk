import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { ViewControllerSearchResults            } from './component';
import { ViewRequestItem                        } from './request/component';
import { TopBarSearchRequest                    } from './search.request/component';
import { Components as ComponentsCommmon        } from '../../core/components/common/components';



@NgModule({
    entryComponents : [ TopBarSearchRequest, ViewRequestItem ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ ViewControllerSearchResults, TopBarSearchRequest, ViewRequestItem ],
    exports         : [ ViewControllerSearchResults, TopBarSearchRequest, ViewRequestItem ]
})

export class ViewSearchResultsModule {
    constructor(){
    }
}