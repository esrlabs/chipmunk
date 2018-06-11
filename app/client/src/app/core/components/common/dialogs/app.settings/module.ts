import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DialogSettingsManager                  } from './component';
import { DialogVisualSettingTab                 } from './visual/component';
import { DialogOutputSettingTab                 } from './output/component';
import { DialogSettingsManagerImporter          } from './importer/component';

import { Components as ComponentsCommmon        } from '../../../common/components';



@NgModule({
    entryComponents : [ DialogSettingsManager, DialogVisualSettingTab, DialogOutputSettingTab, DialogSettingsManagerImporter ],
    imports         : [ CommonModule, ComponentsCommmon ],
    declarations    : [ DialogSettingsManager, DialogVisualSettingTab, DialogOutputSettingTab, DialogSettingsManagerImporter ],
    exports         : [ DialogSettingsManager, DialogVisualSettingTab, DialogOutputSettingTab, DialogSettingsManagerImporter ]
})

export class DialogSettingsModule {
    constructor(){
    }
}