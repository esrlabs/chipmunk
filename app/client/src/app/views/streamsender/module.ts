import { NgModule                               } from '@angular/core';
import { BrowserModule                          } from '@angular/platform-browser';
import { FormsModule                            } from '@angular/forms'
import { CommonModule                           } from '@angular/common';

import { ViewControllerStreamSender             } from './component';
import { Components as ComponentsCommmon        } from '../../core/components/common/components';
import { StreamSenderHistoryItem                } from './history.item/component';



@NgModule({
    entryComponents : [ StreamSenderHistoryItem ],
    imports         : [ BrowserModule, FormsModule, CommonModule, ComponentsCommmon ],
    declarations    : [ ViewControllerStreamSender, StreamSenderHistoryItem ],
    exports         : [ ViewControllerStreamSender, StreamSenderHistoryItem ]
})

export class ViewStreamSenderModule {
    constructor(){
    }
}