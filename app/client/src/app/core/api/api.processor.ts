import { isAPICommandValid                      } from './api.commands';
import { Request, Method, DIRECTIONS, CALLBACKS } from '../modules/tools.ajax';

import { events as Events                       } from '../modules/controller.events';
import { configuration as Configuration         } from '../modules/controller.config';
import { Logs, TYPES                            } from '../modules/tools.logs';
import { APIResponse                            } from './api.response.interface';
import { settings, IServerSetting               } from '../modules/controller.settings';

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

class APIProcessor{
    private GUID        : string = null;
    private loader      : SettingsLoader;
    private settings    : IServerSetting = null;

    constructor(){
    }

    private validator(response : any){
        if (typeof response === 'object' && response !== null){
            return true;
        } else {
            return false;
        }
    }

    onWS_SETTINGS_CHANGED(settings: any){
        let isValid = true;
        if (typeof settings === 'object' && settings !== void 0) {
            if (isValid){
                this.loader.save(settings);
                this.settings = this.loader.load();
            } else {
                Logs.msg('Not valid configuration come from WS_SETTINGS_CHANGED event', TYPES.WARNING);
            }
        } else {
            Logs.msg('Bad configuration come from WS_SETTINGS_CHANGED event', TYPES.WARNING);
        }
    }

    init(){
        this.loader     = new SettingsLoader();
        this.settings   = this.loader.load();
        Events.bind(Configuration.sets.SYSTEM_EVENTS.API_GUID_IS_ACCEPTED,  this.onAPI_GUID_IS_ACCEPTED.bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.WS_SETTINGS_CHANGED,   this.onWS_SETTINGS_CHANGED.bind(this));
    }

    validateResponse(response : APIResponse){
        if (typeof response === 'object' && response !== void 0){
            if (typeof response.code === 'number' && response.output !== void 0){
                return true;
            }
        }
        return false;
    }

    send(command: string, params : Object, callback: Function){
        if (this.GUID !== null){
            if (isAPICommandValid(command)){
                let request = new Request({
                    url         : this.settings.API_URL,
                    method      : new Method(DIRECTIONS.POST),
                    validator   : this.validator,
                    post        : {
                        GUID    : this.GUID,
                        command : command,
                        params  : params
                    }
                }).then((response : APIResponse)=>{
                    if (this.validateResponse(response)){
                        callback(response, null);
                    } else {
                        callback(null, new Error(_('Not valid response')));
                    }
                }).catch((error : Error)=>{
                    callback(null, error);
                });
            } else {
                Logs.msg(_('Unknown API command ') + '(' + command + ')', TYPES.ERROR);
                callback(null, new Error(_('Unknown API command ') + '(' + command + ')'));
            }
        } else {
            Logs.msg(_('Client GUID is not accepted yet.'), TYPES.ERROR);
            callback(null, new Error(_('Client GUID is not accepted yet.')));
        }
    }

    onAPI_GUID_IS_ACCEPTED(GUID: string){
        if (typeof GUID === 'string' && GUID.trim() !== ''){
            this.GUID = GUID;
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.API_IS_READY_TO_USE);
        }
    }
}

let processor = new APIProcessor();

export { processor as APIProcessor };
