import { Logs, TYPES as LogTypes        } from './tools.logs.js';
import { localSettings, KEYs            } from './controller.localsettings';
import { configuration as Configuration } from './controller.config';
import { merge                          } from './tools.objects.merge.js';


interface IVisualSettings {
    prevent_ascii_colors_always         : boolean,
    prevent_ascii_colors_on_highlight   : boolean,
    do_not_highlight_matches_in_requests: boolean,
    highlight_search_requests           : boolean,
    show_active_search_results_always   : boolean
}

interface IServerSetting {
    API_URL                 : string,
    WS_URL                  : string,
    WS_PROTOCOL             : string,
    WS_RECONNECTION_TIMEOUT : number
}

interface ISettings {
    version : string,
    visual  : IVisualSettings,
    server  : IServerSetting
}

class ControllerSettings{
    private storage : ISettings = null;

    constructor(){
        this.load();
    }

    private save(){
        localSettings.set({
            [KEYs.settings]: this.storage
        });
    }

    private load(){
        let storage = localSettings.get();
        if (typeof storage === 'object' && storage !== null && typeof storage[KEYs.settings] === 'object' && storage[KEYs.settings] !== null ) {
            this.storage = storage[KEYs.settings] as ISettings;
        } else if (typeof Configuration.sets.SETTINGS === 'object' && Configuration.sets.SETTINGS !== null && Object.keys(Configuration.sets.SETTINGS).length > 0) {
            this.storage = Configuration.sets.SETTINGS as ISettings;
        }
    }

    get(){
        this.storage === null && this.load();
        return Object.assign({}, this.storage);
    }

    set(data : Object){
        if (typeof data === 'object' && data !== null){
            let accepted = {};
            Object.keys(data).forEach((key)=>{
                if (this.storage[key] !== void 0){
                    accepted[key] = data[key];
                } else {
                    Logs.msg('Property [' + key + '] is not defined in default settings. Check, please, module [controller.localstorage]', LogTypes.WARNING);
                }
            });
            merge(this.storage, accepted);
            this.save();
        }
    }
}

let settings = new ControllerSettings();

export { settings, ISettings, IVisualSettings, IServerSetting };
