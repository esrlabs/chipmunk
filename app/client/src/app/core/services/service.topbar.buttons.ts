
import { Injectable, OnDestroy                                  } from "@angular/core";

import { ToolBarButton                                          } from './class.toolbar.button';
import { staticTopBarButtonsStorage, StaticTopBarButtonsStorage } from './service.topbar.buttons.static';

import { events as Events                                       } from '../modules/controller.events';
import { configuration                                          } from '../modules/controller.config';

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
    }

    removeButton(id: string | number | symbol){
        this.storage.removeButton(id);
    }

    updateButton(button: ToolBarButton){
        this.storage.updateButton(button);
    }
}
