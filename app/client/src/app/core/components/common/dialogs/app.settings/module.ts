import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DialogSettingsManager                  } from './component';
import { DialogVisualSettingTab                 } from './visual/component';
import { DialogOutputSettingTab                 } from './output/component';
import { Components as ComponentsCommmon        } from '../../../common/components';



@NgModule({
    entryComponents : [ DialogSettingsManager, DialogVisualSettingTab, DialogOutputSettingTab ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ DialogSettingsManager, DialogVisualSettingTab, DialogOutputSettingTab ],
    exports         : [ DialogSettingsManager, DialogVisualSettingTab, DialogOutputSettingTab ]
})

export class DialogSettingsModule {
    constructor(){
    }
}