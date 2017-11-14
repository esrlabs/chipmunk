import { Request, Method, DIRECTIONS} from './tools.ajax';
import { validator as ObjValidator  } from './tools.objects.validator';
import { Logs, TYPES as LogTypes    } from './tools.logs';

import { InitiableModule            } from '../interfaces/interface.module.initiable';
import { ConfigurationSets          } from '../interfaces/interface.configuration.sets';

const ALIASES = {
    SETS        : 'SETS',
    ORDERING    : 'ORDERING'
};

const SETTINGS = {
    PATH        : 'app/config/',
    REGISTER    : 'register.json',
    VALIDATOR   : {[ALIASES.SETS] : Object.prototype, [ALIASES.ORDERING] : Array.prototype}
};

class ConfigurationController implements InitiableModule{
    private register    : Object    = {};
    private queue       : any[]     = [];
    private callback    : Function  = null;
    public sets         : ConfigurationSets = new ConfigurationSets();

    constructor(){
    }

    public init(callback : Function = null){
        Logs.msg('[controller.config] Start loading configuration.', LogTypes.LOADING);
        (new Request({
            url         : SETTINGS.PATH + SETTINGS.REGISTER,
            method      : new Method(DIRECTIONS.GET),
            validator   : this.validator
        })).then((response : Object)=>{
            let validation = ObjValidator.validate(response, SETTINGS.VALIDATOR);
            if (!(validation instanceof Error)){
                this.register = response;
                this.queue.push(...this.register[ALIASES.ORDERING]);
                Logs.msg('[controller.config][OK]:: ' + SETTINGS.REGISTER, LogTypes.LOADING);
                this.load();
            } else {
                throw new Error('Structure of [register] is not valid: ' + validation.message);
            }
        }).catch((error : Error)=>{
            let message = 'no error details';
            if (typeof error === 'object' && error !== null && typeof error.message === 'string'){
                message = error.message;
            }
            throw new Error('Can not load register of configuration. Error: ' + message);
        });
        this.callback = typeof callback === 'function' ? callback : function () {};
    }

    private parser(response : any){
        if (typeof response === 'object' && response !== null){
            return response;
        } else {
            //Try remove comments
            response = response.replace(/\/\*[^]*?\*\//gmi, '').replace(/\/\/.*/gi, '');
            //Try manually parse
            try {
                response = JSON.parse(response);
                return response;
            } catch (e){}
            return null;
        }
    }

    private validator(response : any){
        if (typeof response === 'object' && response !== null){
            return true;
        } else {
            return false;
        }
    }

    private getPromise(source : string){
        return new Promise((resolve, reject) => {
            let request = new Request({
                url         : SETTINGS.PATH + this.register[ALIASES.SETS][source],
                method      : new Method(DIRECTIONS.GET),
                validator   : this.validator,
                parser      : this.parser
            }).then((response : Object)=>{
                this.sets[source] = response;
                Logs.msg('[controller.config][OK]:: ' + source, LogTypes.LOADING);
                resolve();
            }).catch((error : Error)=>{
                let message = 'no error details';
                if (typeof error === 'object' && error !== null && typeof error.message === 'string'){
                    message = error.message;
                }
                reject();
                throw new Error('Can not load source [' + source + '] of configuration. Error: ' + message);
            });
        });
    }

    private getQueue(){
        let sources = this.queue.shift();
        typeof sources === 'string' && (sources = [sources]);
        if (sources instanceof Array){
            return sources.map((source)=>{
                if (this.register[ALIASES.SETS][source] !== void 0){
                    return this.getPromise(source);
                } else {
                    throw new Error('Preset [' + source + '] does not have definition in section ['+ALIASES.SETS+']. Check [register.json].');
                }
            });
        }else {
            throw new Error('Definition of ordering in [' +  SETTINGS.REGISTER + '] has wrong format. Expect: STRING or STRING[].');
        }
    }

    private freeze(){
        this.sets = Object.freeze(Object.assign({}, this.sets))
    }

    private nextInQueue(){
        Promise.all(this.getQueue()).then(()=>{
            if (this.queue.length > 0){
                this.nextInQueue();
            } else {
                Logs.msg('[controller.config] Finish loading configuration.', LogTypes.LOADING);
                this.freeze();
                this.callback();
            }
        }).catch((error)=>{
            let message = 'no error details';
            if (typeof error === 'object' && error !== null && typeof error.message === 'string'){
                message = error.message;
            }
            throw new Error('Can not load some source of configuration. Error: ' + message);
        });
    }

    private load(){
        this.nextInQueue();
    }

}

let configuration = new ConfigurationController();

export { configuration as configuration }

