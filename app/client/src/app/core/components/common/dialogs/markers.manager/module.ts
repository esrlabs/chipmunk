import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { DialogMarkersManager                   } from './component';
import { DialogMarkersManagerItem               } from './marker/component';
import { Components as ComponentsCommmon        } from '../../../common/components';

@NgModule({
    entryComponents : [ DialogMarkersManager, DialogMarkersManagerItem ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ DialogMarkersManager, DialogMarkersManagerItem ],
    exports         : [ DialogMarkersManager, DialogMarkersManagerItem ]
})

export class DialogMarkersManagerModule {
    constructor(){
    }
}