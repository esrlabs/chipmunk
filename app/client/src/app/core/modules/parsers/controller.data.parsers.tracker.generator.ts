import { Logs, TYPES            } from '../tools.logs.js';
import { ParsedResultIndexes    } from './controller.data.parsers.tracker.inerfaces.js';


class Generator {
    private cacheRegs   : Object = {};
    private history     : Object = {};

    getRegExp(regStr: string){
        try{
            this.cacheRegs[regStr] === void 0 && (this.cacheRegs[regStr] = new RegExp(regStr, 'gi'));
        } catch (e){
            Logs.msg(`Cannot create RegExp based on [${regStr}].`, TYPES.ERROR);
            this.cacheRegs[regStr] = null;
        }
        return this.cacheRegs[regStr];
    }

    save(key: string, values: Array<ParsedResultIndexes>){
        if (this.history[key] === void 0){
            this.history[key] = values;
         } else {
            Logs.msg(`History for [${key}] is already saved.`, TYPES.ERROR);
        }
    }

    load(key: string){
        return this.history[key] !== void 0 ? this.history[key] : null;
    }

    getKey(GUID: string, segments: Array<string>){
        return GUID + segments.join();
    }
};

const generator = new Generator();

export { generator }