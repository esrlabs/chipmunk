import { Logs, TYPES            } from '../tools.logs.js';
import { ParsedResultIndexes    } from './controller.data.parsers.tracker.inerfaces.js';

/*
* Caching doesn't make any sense while timestamp isn't excluded from string.
*/
class Generator {
    private cacheRegs   : Object = {};

    getRegExp(regStr: string){
        try{
            this.cacheRegs[regStr] === void 0 && (this.cacheRegs[regStr] = new RegExp(regStr, 'gi'));
        } catch (e){
            Logs.msg(`Cannot create RegExp based on [${regStr}].`, TYPES.ERROR);
            this.cacheRegs[regStr] = null;
        }
        return this.cacheRegs[regStr];
    }

};

const generator = new Generator();

export { generator }