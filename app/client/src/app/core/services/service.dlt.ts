import { events as Events                       } from '../modules/controller.events';
import { configuration as Configuration         } from '../modules/controller.config';
import { ToolBarButton                          } from './class.toolbar.button';
import { OpenDLTStream                          } from '../handles/handle.open.dlt.stream';

class Dlt {

    private id : symbol = null;

    constructor() {
        this.API_GUID_IS_ACCEPTED = this.API_GUID_IS_ACCEPTED.bind(this);
        this.WS_DISCONNECTED = this.WS_DISCONNECTED.bind(this);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.API_GUID_IS_ACCEPTED, this.API_GUID_IS_ACCEPTED);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED, this.WS_DISCONNECTED);
    }

    API_GUID_IS_ACCEPTED(){
        if (this.id === null) {
            this.id = Symbol();
            Events.trigger(Configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, {
                id: this.id,
                icon: 'fa fa-thermometer-3',
                caption: 'Connect to DLT Deamon',
                handle: this.openStream.bind(this)
            } as ToolBarButton);
        }
    }

    WS_DISCONNECTED(){
        if (this.id !== null){
            Events.trigger(Configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, this.id);
            this.id = null;
        }
    }

    openStream(){
        let openTerminalStream = new OpenDLTStream();
        openTerminalStream.start();
    }

}

export { Dlt }