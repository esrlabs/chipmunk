import { InitiableModule                } from '../interfaces/interface.module.initiable.js';
import { configuration as Configuration } from './controller.config.js';

const TYPES = {
    LOG             : 'LOG',
    WARNING         : 'WARNING',
    ERROR           : 'ERROR',
    DEBUG           : 'DEBUG',
    LOADING         : 'LOADING',
    UI              : 'UI',
    MEASURE         : 'MEASURE',
    EVENT_TRACKING  : 'EVENT_TRACKING'
};

interface IntLogMessage{
    timestamp    : number;
    type         : string;
    msg          : string;
}

class LogMessage implements IntLogMessage{
    timestamp    : number;
    type         : string;
    msg          : string;
    constructor (   timestamp  : number = 0,
                    type       : string,
                    msg        : string){
        this.timestamp  = timestamp;
        this.type       = type;
        this.msg        = msg;
    }
}

class Logs implements InitiableModule{

    private logs : Array<Object>    = [];
    private marks: Object           = {};

    private addAsStr(msg : string, type : string, console : boolean = false){
        let message = new LogMessage((new Date()).getTime(), type, msg);
        this.logs.push(message);
        if (Configuration.sets.LOGS !== void 0 && Configuration.sets.LOGS.SHOW instanceof Array){
            ~Configuration.sets.LOGS.SHOW.indexOf(type) && (console = true);
        } else {
            console = true;
        }
        console && this.console(message);
    }

    private console(msg : LogMessage){
        console.log('[' + msg.timestamp + '][' + msg.type + ']:: ' + msg.msg);
    }

    private parseIncomeMsg(smth : any = null, type : string){
        if (typeof smth === 'string'){
            this.addAsStr(smth, type);
        } else if (smth instanceof Array){
            smth.forEach((smth)=>{
                this.parseIncomeMsg(smth, type);
            });
        } else if (typeof smth === 'object' && smth !== null){
            this.addAsStr(JSON.stringify(smth), type);
        } else if (smth !== null && typeof smth.toString === 'function'){
            this.addAsStr(smth.toString(), type);
        } else {
            this.addAsStr('Cannot recognize value of log-message', TYPES.WARNING, true);
        }
    }

    private parseType(type : string = TYPES.LOG){
        if (typeof type === 'string' && TYPES[type] !== void 0){
            return TYPES[type];
        } else {
            this.addAsStr('Type of logs [' + type + '] does not support.', TYPES.WARNING, true);
            return TYPES.LOG;
        }
    }

    public msg(smth : any = null, type : string = TYPES.LOG){
        this.parseIncomeMsg(smth, this.parseType(type));
    }

    public init(callback : Function ){
        callback();
    }

    public measure(mark: symbol | string){
        //TODO: clearing stucked marks.
        typeof mark === 'string' && (mark = Symbol(mark));
        if (this.marks[mark] === void 0){
            this.marks[mark] = performance.now();
        } else {
            let duration = performance.now() - this.marks[mark];
            this.msg(mark.toString().replace(/^Symbol\(/gi, '').replace(/\)$/gi, '') + ': ' + duration.toFixed(2) + 'ms; ' + (duration / 1000).toFixed(2) + 's.', TYPES.MEASURE);
            delete this.marks[mark];
        }
        return mark;
    }
}

let logs = new Logs();

export { logs as Logs, TYPES }

