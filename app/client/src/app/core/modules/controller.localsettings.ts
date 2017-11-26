import { Logs, TYPES as LogTypes    } from './tools.logs';
import { merge                      } from './tools.objects.merge';

const SETTINGS = {
    KEY : 'logviewer.localstare'
};

const KEYs = {
    views               : 'views',
    shortcuts           : 'shortcuts',
    api                 : 'api',
    view_serialsender   : 'view_serialsender',
    view_markers        : 'view_markers',
    view_statemonitor   : 'view_statemonitor',
    view_searchrequests : 'view_searchrequests',
    view_charts         : 'view_charts',
    serial_ports        : 'serial_ports',
    themes              : 'themes',
    adblogccat_stream   : 'adblogccat_stream'
};

class ControllerLocalSettings{
    private storage : Object = {};

    constructor(){
        this.initialize();
    }

    initialize(){
        let storage     = this.load(),
            valid       = true;
        if (typeof storage === 'object' && storage !== null){
            Object.keys(this.defaults()).forEach((key)=>{
                storage[key] === void 0 && (valid = false);
            });
            this.storage = valid ? storage : this.defaults();
        } else {
            this.storage = this.defaults();
        }
    }

    defaults(){
        let result = {};
        Object.keys(KEYs).forEach((key)=>{
            result[key] = null;
        });
        return result;
    }

    private load(){
        let result = window.localStorage.getItem(SETTINGS.KEY);
        if (typeof result === 'string'){
            try {
                result = JSON.parse(result);
            } catch (e) {
                result = null;
            }
        } else if (typeof result !== 'object'){
            result = null;
        }
        return result;
    }

    private save(){
        window.localStorage.setItem(SETTINGS.KEY, JSON.stringify(this.storage));
    }

    get(){
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

    reset(key: string, reason: string){
        if (this.storage[key] !== void 0 && typeof reason === 'string' && reason.trim() !== ''){
            this.storage[key] = {};
            Logs.msg('Property [' + key + '] was reset by reason: ' + reason, LogTypes.WARNING);
        } else {
            Logs.msg('Property cannot be reset without defined reason.', LogTypes.WARNING);
        }
        this.save();
    }
}

let localSettings = new ControllerLocalSettings();

export { localSettings, KEYs };
