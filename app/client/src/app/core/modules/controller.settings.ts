import { Logs, TYPES as LogTypes        } from './tools.logs.js';
import { localSettings, KEYs            } from './controller.localsettings';
import { configuration as Configuration } from './controller.config';
import { merge                          } from './tools.objects.merge.js';


interface IVisualSettings {
    prevent_ascii_colors_always                 : boolean,
    prevent_ascii_colors_on_highlight           : boolean,
    do_not_highlight_matches_in_requests        : boolean,
    highlight_search_requests                   : boolean,
    show_active_search_results_always           : boolean,
    make_filters_active_after_search_is_cleared : boolean,
    use_autobottom_scroll                       : boolean
}

interface IOutputSettings {
    remove_empty_rows_from_stream: boolean
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
    output  : IOutputSettings,
    server  : IServerSetting
}

const CHECK_DEFAULTS = ['visual', 'output'];

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

    checkVersion(){
        if (this.storage === null){
            return;
        }
        if (typeof Configuration.sets.SETTINGS !== 'object' || Configuration.sets.SETTINGS === null || Object.keys(Configuration.sets.SETTINGS).length === 0) {
            return;
        }
        if (this.storage.version === Configuration.sets.SETTINGS.version){
            return;
        }
        if (Configuration.sets.SETTINGS.drop_rules instanceof Array){
            Configuration.sets.SETTINGS.drop_rules.forEach((section: string)=>{
                this.storage[section] = null;
            });
            this.storage.version = Configuration.sets.SETTINGS.version;
            this.save();
        }
    }

    checkForDefaults(storage: any){
        if (storage === null){
            return storage;
        }
        if (typeof Configuration.sets.SETTINGS !== 'object' || Configuration.sets.SETTINGS === null || Object.keys(Configuration.sets.SETTINGS).length === 0) {
            return storage;
        }
        CHECK_DEFAULTS.forEach((alias: string)=>{
            if (Configuration.sets.SETTINGS[alias] === void 0 || typeof Configuration.sets.SETTINGS[alias] !== 'object' || Configuration.sets.SETTINGS[alias] === null){
                return;
            }
            if (storage[alias] === void 0 || storage[alias] === null){
                storage[alias] = Object.assign({}, Configuration.sets.SETTINGS[alias]);
            }
        });
        return storage;
    }

    get(){
        this.storage === null && this.load();
        this.checkVersion();
        return Object.assign({}, this.checkForDefaults(this.storage));
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

export { settings, ISettings, IVisualSettings, IOutputSettings, IServerSetting };
