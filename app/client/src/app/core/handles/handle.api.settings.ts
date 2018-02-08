import { popupController                } from '../components/common/popup/controller';
import { DialogAPISettings              } from '../components/common/dialogs/api.settings/component';
import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';
import { IServerSetting, settings       } from "../modules/controller.settings";

class SettingsLoader{
    load(){
        const _settings = settings.get();
        return _settings.server;
    }
    save(serverSettings: IServerSetting){
        let _settings = settings.get();
        _settings.server = serverSettings;
        settings.set(_settings);
    }
}

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
                    server          : this.settings,
                    proceed         : function (serverSettings : IServerSetting) {
                        Events.trigger(Configuration.sets.SYSTEM_EVENTS.WS_SETTINGS_CHANGED, serverSettings);
                    }.bind(this),
                    cancel          : ()=>{},
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