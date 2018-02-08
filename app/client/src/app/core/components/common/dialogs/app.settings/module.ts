import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DialogSettingsManager                   } from './component';
import { DialogVisualSettingTab                 } from './visual/component';
import { Components as ComponentsCommmon        } from '../../../common/components';



@NgModule({
    entryComponents : [ DialogSettingsManager, DialogVisualSettingTab ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ DialogSettingsManager, DialogVisualSettingTab ],
    exports         : [ DialogSettingsManager, DialogVisualSettingTab ]
})

export class DialogSettingsModule {
    constructor(){
    }
}