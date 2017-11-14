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
import { controllerThemes                   } from './core/modules/controller.themes';

import { ShortcutController                 } from './core/modules/controller.shortcut';

@NgModule({
    imports:      [ BrowserModule, ComponentsCommmon, TopBarModule, HolderModule ],
    declarations: [ Layout, RootHolder ],
    bootstrap:    [ Layout ]
})

export class AppModule {
    private wsConnector         : WebSocketConnector = null;
    private shortcutController  : ShortcutController = new ShortcutController();
    private serialPorts         : SerialPorts        = new SerialPorts();

    constructor(){
        APIProcessor.init();
        controllerThemes.init();
        this.wsConnector = new WebSocketConnector();
        this.wsConnector.connect();
    }
}
