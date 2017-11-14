import { MenuHandleInterface            } from './handle.interface';
import { popupController                } from '../components/common/popup/controller';
import { ProgressBarCircle              } from '../components/common/progressbar.circle/component';
import { DialogAPISettings              } from '../components/common/dialogs/api.settings/component';
import { SettingsLoader                 } from '../ws/ws.connector';
import { SET_KEYS                       } from '../interfaces/interface.configuration.sets.system';

import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';

class APISettings{

    private loader      : SettingsLoader    = new SettingsLoader();
    private settings    : any               = {};

    constructor(){
        this.settings = this.loader.load();
    }

    dialog(){
        let GUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogAPISettings,
                params      : {
                    serverAPI           : this.settings[SET_KEYS.API_URL],
                    serverWS            : this.settings[SET_KEYS.WS_URL],
                    serverWSProtocol    : this.settings[SET_KEYS.WS_PROTOCOL],
                    serverWSTimeout     : this.settings[SET_KEYS.WS_RECONNECTION_TIMEOUT],
                    proceed             : function (params : any) {
                        Events.trigger(Configuration.sets.SYSTEM_EVENTS.WS_SETTINGS_CHANGED, params)
                    }.bind(this),
                    cancel              : ()=>{},
                }
            },
            title   : _('Connection to remote service'),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '35rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : GUID
        });
    }
}

export { APISettings };