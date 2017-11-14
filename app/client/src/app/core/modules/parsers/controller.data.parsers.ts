import { Timestamp  } from './controller.data.parsers.timestamp';
import { Parser     } from './controller.data.parsers.tracker'

class Parsers {
    private parsers : {
        timestamp   : any,
        tracks      : any,
    } = {
        timestamp   : new Timestamp(),
        tracks      : new Parser()
    };

    constructor(){

    }

    parse(str : string){
        var result = {};
        Object.keys(this.parsers).forEach((parser: string)=>{
            result[parser] = this.parsers[parser].parse(str);
        });
        return result;
    }
}

export { Parsers }