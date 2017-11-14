import { NgModule                               } from '@angular/core';
import { BrowserModule                          } from '@angular/platform-browser';
import { FormsModule                            } from '@angular/forms'
import { CommonModule                           } from '@angular/common';

import { ViewControllerMarkers                  } from './component';
import { ViewMarkersItem                        } from './marker/component';
import { Components as ComponentsCommmon        } from '../../core/components/common/components';



@NgModule({
    entryComponents : [ ViewMarkersItem ],
    imports         : [ BrowserModule, FormsModule, CommonModule, ComponentsCommmon ],
    declarations    : [ ViewControllerMarkers, ViewMarkersItem ],
    exports         : [ ViewControllerMarkers, ViewMarkersItem ]
})

export class ViewMarkersModule {
    constructor(){
    }
}