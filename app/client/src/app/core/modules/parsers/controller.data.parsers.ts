import { Parser as Tracker  } from './controller.data.parsers.tracker.js'

class Parsers {
    private parsers : {
        tracks      : any,
    } = {
        tracks      : new Tracker()
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