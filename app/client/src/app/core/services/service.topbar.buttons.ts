
import { Injectable, OnDestroy                                  } from "@angular/core";

import { ToolBarButton                                          } from './class.toolbar.button';
import { staticTopBarButtonsStorage, StaticTopBarButtonsStorage } from './service.topbar.buttons.static';

import { events as Events                                       } from '../modules/controller.events';
import { configuration                                          } from '../modules/controller.config';
import { topbarMenuHandles                                      } from '../handles/topbar.menu.hadles';

@Injectable()

export class ServiceTopBarButtons implements OnDestroy{
    private storage : StaticTopBarButtonsStorage = staticTopBarButtonsStorage;

    constructor(){
        this.addButton      = this.addButton.bind(this);
        this.removeButton   = this.removeButton.bind(this);
        this.updateButton   = this.updateButton.bind(this);
        Events.bind(configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON,       this.addButton);
        Events.bind(configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON,    this.removeButton);
        Events.bind(configuration.sets.EVENTS_TOOLBAR.UPDATE_BUTTON,    this.updateButton);
        this._loadStaticButtons();
    }

    ngOnDestroy(){
        Events.unbind(configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON,       this.addButton);
        Events.unbind(configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON,    this.removeButton);
        Events.unbind(configuration.sets.EVENTS_TOOLBAR.UPDATE_BUTTON,    this.updateButton);
    }

    getItems() : Promise<ToolBarButton[]>{
        return Promise.resolve(this.storage.getItems());
    }

    addButton(button: ToolBarButton | Array<ToolBarButton>){
        this.storage.addButton(button);
        Events.trigger(configuration.sets.EVENTS_TOOLBAR.FORCE_REFRESH_TOOLBAR);
    }

    removeButton(id: string | number | symbol){
        this.storage.removeButton(id);
        Events.trigger(configuration.sets.EVENTS_TOOLBAR.FORCE_REFRESH_TOOLBAR);
    }

    updateButton(button: ToolBarButton){
        this.storage.updateButton(button);
        Events.trigger(configuration.sets.EVENTS_TOOLBAR.FORCE_REFRESH_TOOLBAR);
    }

    _loadStaticButtons(){
        configuration.sets.MENU.bar !== void 0 && configuration.sets.MENU.bar.forEach((button: any) => {
            if (typeof topbarMenuHandles[button.handler] === 'function') {
                this.storage.addButton({
                    id      : button.guid !== void 0 ? button.guid : Symbol(),
                    icon    : button.icon !== void 0 ? button.icon : '',
                    caption : button.icon !== void 0 ? button.icon : '',
                    handle  : topbarMenuHandles[button.handler],
                    enable  : button.enable !== void 0 ? button.enable : true
                });
            }
        });
    }
}
