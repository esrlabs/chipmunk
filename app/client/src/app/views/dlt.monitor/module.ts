import { NgModule                               } from '@angular/core';
import { BrowserModule                          } from '@angular/platform-browser';
import { FormsModule                            } from '@angular/forms'
import { CommonModule                           } from '@angular/common';

import { ViewControllerDLTMonitor               } from './component';
import { Components as ComponentsCommmon        } from '../../core/components/common/components';



@NgModule({
    entryComponents : [ /*StreamSenderHistoryItem*/ ],
    imports         : [ BrowserModule, FormsModule, CommonModule, ComponentsCommmon ],
    declarations    : [ ViewControllerDLTMonitor, /*StreamSenderHistoryItem*/ ],
    exports         : [ ViewControllerDLTMonitor, /*StreamSenderHistoryItem*/ ]
})

export class ViewControllerDLTMonitorModule {
    constructor(){
    }
}