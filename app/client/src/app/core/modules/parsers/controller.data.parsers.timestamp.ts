import { ParserClass } from './controller.data.parsers.tracker.inerfaces.js';

class Timestamp implements ParserClass{
    protected reg: RegExp = /\d{2}\-\d{2} \d{2}:\d{2}:\d{2}(\.\d{3})?/gi;
    //12-11 12:00:00.300
    //012345678901234567
    parse(str : string) : Object{
        let matches: Array<string>      = str.match(this.reg),
            result : any                = {},
            year                        = (new Date()).getFullYear();
        matches = matches instanceof Array ? matches : [];
        result  = matches.map((match : string)=>{
            let MM = parseInt(match.substr(0,2), 10) - 1,
                DD = parseInt(match.substr(3,2), 10),
                hh = parseInt(match.substr(6,2), 10),
                mm = parseInt(match.substr(9,2), 10),
                ss = parseInt(match.substr(12,2), 10),
                ms = parseInt(match.substr(15,3), 10),
                d  = new Date(year, MM, DD, hh, mm, ss, ms);
            return {
                datetime    : d,
                timestamp   : d.getTime()
            };
        });
        return result;
    }
}

export { Timestamp }