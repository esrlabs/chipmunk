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
import { Telnet                             } from './core/services/service.telnet';
import { Terminal                           } from './core/services/service.terminal';

import { controllerThemes                   } from './core/modules/controller.themes';

import { ShortcutController                 } from './core/modules/controller.shortcut';
import { MarkersController                  } from './core/modules/controller.markers';

import { Updater                            } from './core/modules/controller.updater';

import { MonitorManager                     } from './core/handles/hanlde.open.monitor.manager';

import { viewsParameters                    } from './core/services/service.views.parameters';

import { serviceRequests                    } from './core/services/service.requests';
import { OpenByURLOnStartUp                 } from './core/modules/controller.openbyurl.startup';


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
    private telnet              : Telnet                = new Telnet();
    private terminal            : Terminal              = new Terminal();
    private updater             : Updater               = new Updater();
    private markersController   : MarkersController     = new MarkersController();
    private openByURLOnStartUp  : OpenByURLOnStartUp    = new OpenByURLOnStartUp();

    constructor(){
        MonitorManager.init();
        controllerThemes.init();
        viewsParameters.init();
        serviceRequests.init();
        this.markersController.init();
        //Init communication
        APIProcessor.init();
        this.wsConnector = new WebSocketConnector();
        this.wsConnector.connect();
    }
}
