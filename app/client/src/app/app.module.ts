import { NgModule                           } from '@angular/core';
import { BrowserModule                      } from '@angular/platform-browser';

import { Layout                             } from './core/grid/layout/component';
import { RootHolder                         } from './core/grid/root-holder/component';

import { HolderModule                       } from './core/grid/holder/module';
import { TopBarModule                       } from './core/grid/top-bar/module';
import { Components as ComponentsCommmon    } from './core/components/common/components';

import { WebSocketConnector                 } from './core/ws/ws.connector';
import { APIProcessor                       } from './core/api/api.processor';

import { SerialPorts                        } from './core/services/service.serialports';
import { ADBLogcat                          } from './core/services/service.adblogcat';
import { controllerThemes                   } from './core/modules/controller.themes';

import { ShortcutController                 } from './core/modules/controller.shortcut';
import { MarkersController                  } from './core/modules/controller.markers';

import { Updater                            } from './core/modules/controller.updater';

import { MonitorManager                     } from './core/handles/hanlde.open.monitor.manager';

@NgModule({
    imports:      [ BrowserModule, ComponentsCommmon, TopBarModule, HolderModule ],
    declarations: [ Layout, RootHolder ],
    bootstrap:    [ Layout ]
})

export class AppModule {
    private wsConnector         : WebSocketConnector    = null;
    private shortcutController  : ShortcutController    = new ShortcutController();
    private serialPorts         : SerialPorts           = new SerialPorts();
    private adbLogcat           : ADBLogcat             = new ADBLogcat();
    private updater             : Updater               = new Updater();
    private markersController   : MarkersController     = new MarkersController();

    constructor(){
        //Init others
        MonitorManager.init();
        //Init communication
        APIProcessor.init();
        controllerThemes.init();
        this.markersController.init();
        this.wsConnector = new WebSocketConnector();
        this.wsConnector.connect();
    }
}
