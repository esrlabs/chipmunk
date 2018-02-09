import { events as Events                       } from '../../core/modules/controller.events';
import { configuration as Configuration         } from '../../core/modules/controller.config';
import { ToolBarButton                          } from '../../core/services/class.toolbar.button';
import { OpenADBLogcatStream                    } from '../handles/handle.open.adblogcat.stream';

class ADBLogcat {

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
                icon: 'fa fa-android',
                caption: 'ADB Logcat',
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
        let openADBLogcatStream = new OpenADBLogcatStream();
        openADBLogcatStream.start();
    }

}

export { ADBLogcat }