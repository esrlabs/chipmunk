import { InitiableModule                } from '../interfaces/interface.module.initiable';
import { Logs, TYPES as LogTypes        } from './tools.logs';
import { events as Events               } from './controller.events';
import { configuration as Configuration } from './controller.config';
import { DataRow                        } from '../interfaces/interface.data.row';
import { DataFilter                     } from '../interfaces/interface.data.filter';
import { Parsers                        } from './parsers/controller.data.parsers';
import { MODES                          } from './controller.data.search.modes';
import { GUID                           } from './tools.guid';

import { EVENT_DATA_IS_UPDATED          } from '../interfaces/events/DATA_IS_UPDATE';

class FakeDataGenerator{
    rows        : Array<DataRow>    = [];
    parts       : Array<string>     = [];
    count       : number            = 0;
    last        : Date              = new Date(2017, 3, 4, 14, 59, 31, 738);//04-04 14:59:31.738

    getRandomNmb(lim : number = 100){
        return Math.round(Math.random() * lim);
    }

    makeParts(){
        let res = '',
            src = 'QWERTYUIOPASDFGHJKLZXCVBNM1234567890';
        for(let i = 100; i >= 0; i -= 1){
            res = '';
            for(let j = 16; j >= 0; j -= 1){
                res += src[Math.floor(Math.random() * src.length)];
            }
            this.parts.push(res);
        }
    }

    getRandomStr(index : number = 0){
        let res = '',
            row = new DataRow();
        for(let i = 7; i >= 0; i -= 1){
            row.str += this.parts[Math.floor(Math.random() * (this.parts.length - 1))];
            row.str += ' ... ';
        }
        return row;
    }

    getData(){
        this.makeParts();
        for (let i = this.count; i >= 0; i -= 1){
            this.rows.push(this.getRandomStr(this.count - i + 1));
        }
        return this.rows;
    }

    getNextDataPackage(){
        function normalize(num: number, count: number = 2) : string{
            let res = '' + num;
            res = '0'.repeat(count - res.length) + res;
            return res;
        }
        let patterns    = [
                ' +0200 I/[SC]KEEPALIVE(  465):      04-03 08:00:13.067: [ALIVE] clamp state changed (CLAMP_15 -> CLAMP_50)',
                ' +0200 I/[SC]KEEPALIVE(  465):      04-03 08:00:13.067: [ALIVE] clamp state changed (CLAMP_50 -> CLAMP_15)',
                ' +0200 I/[SC]KEEPALIVE(  465):      04-03 08:00:13.067: [ALIVE] clamp state changed (CLAMP_15 -> CLAMP_R)'
            ];
        return patterns.map((pattern)=>{
            let step = Math.round(Math.random() * 3000),
                next = new Date(this.last.getTime() + step);
            this.last = new Date(next.getTime());
            return  normalize(next.getMonth() + 1, 2)
                    + '-'
                    + normalize(next.getDate(), 2)
                    + ' '
                    + normalize(next.getHours(), 2)
                    + ':'
                    + normalize(next.getMinutes(), 2)
                    + ':'
                    + normalize(next.getSeconds(), 2)
                    + '.'
                    + normalize(next.getMilliseconds(), 3) + ' ' + pattern;
        }).join('\r\n');
    }

    emulateRuntimeDate(){
        let data = this.getNextDataPackage();
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE, data);
        setTimeout(this.emulateRuntimeDate.bind(this), 1000);
    }

    /*
     04-04 08:00:09.981 +0200 I/[SC]KEEPALIVE(  465):      04-03 08:00:13.067: [ALIVE] clamp state changed (CLAMP_15 -> CLAMP_R)
    * */

}


class DataController implements InitiableModule{
    private callback    : Function          = null;
    private generator   : FakeDataGenerator = null;
    private dataFilter  : DataFilter        = new DataFilter();
    private requests    : Object            = {};
    private data        : {
        source  : string,
        rows    : Array<DataRow>,
        indexes : Object
    } = {
        source  : '',
        rows    : [],
        indexes : {}
    };
    private stream      : {
        broken  : string
    } = {
        broken  : ''
    };
    private filters         : Object = {};
    private regExpCache     : Object = {};
    private indexesCache    : Object = {};

    constructor(){
        this.generator = new FakeDataGenerator();
    }

    private bindEvents(){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,    this.onSEARCH_REQUEST_CHANGED.  bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,             this.onTXT_DATA_COME.           bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE,        this.onSTREAM_DATA_UPDATE.      bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.REMEMBER_FILTER,           this.onREMEMBER_FILTER.         bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.FORGET_FILTER,             this.onFORGET_FILTER.           bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_RESET,      this.onSEARCH_REQUEST_RESET.    bind(this));
    }

    public init(callback : Function = null){
        Logs.msg('[controller.data] Initialization.', LogTypes.DEBUG);
        this.callback = typeof callback === 'function' ? callback : function () {};
        //this.generateFake();
        this.bindEvents();
        this.callback();
        Logs.msg('[controller.data] Finished.', LogTypes.DEBUG);
    }

    private generateFake(){
        //this.data.rows      = this.generator.getData();
        //this.data.source    = this.data.rows.join(';');
        this.generator.emulateRuntimeDate();
    }

    public getRows(){
        return this.data.rows;
    }

    resetRegExpCache (){
        this.regExpCache    = {};
        this.indexesCache   = {};
    }

    getTextParser(mode : string){
        function getIndex(index: number){
            for (let i = index; i >= 0; i += 1) {
                if (this.data.indexes[i] !== void 0) {
                    return {
                        index: this.data.indexes[i],
                        start: i
                    };
                }
            }
            return {
                index: -1,
                start: -1
            };
        };
        switch (mode){
            case MODES.TEXT:
                return function (str : string, smth : string) : boolean {
                    return ~str.indexOf(smth) ? true : false;
                }.bind(this);
            case MODES.REG:
                return function (str : string, smth : string, index: number) : boolean {
                    let reg = this.regExpCache[smth] !== void 0 ? this.regExpCache[smth] : null;
                    if (reg === null && smth !== '' || (reg !== null && reg.stamp !== this.data.rows.length) || (reg !== null && index >= this.data.rows.length)){
                        try {
                            let _smth = smth.replace(/\\*$/gi,   '')
                                            .replace(/\\/gi,     '\\');
                            reg = {
                                regExp      : reg !== null ? reg.regExp : new RegExp(_smth  , 'gi'),
                                indexes     : reg !== null ? reg.indexes: {},
                                stamp       : this.data.rows.length > index ? this.data.rows.length : (index + 1),
                                lastIndex   : 0
                            };
                            reg.regExp.lastIndex = reg.lastIndex;
                            do {
                                let match = reg.regExp.exec(this.data.source);
                                let index = null;
                                if (match !== null) {
                                    index = match.index;
                                    index = getIndex.call(this, index);
                                    if (index.index !== -1 && this.data.rows[index.index] !== void 0) {
                                        reg.indexes[index.index] = true;
                                        reg.lastIndex = reg.regExp.lastIndex;
                                        reg.regExp.lastIndex < index.start && (reg.regExp.lastIndex = index.start);
                                    }
                                } else {
                                    break;
                                }
                            } while (true);
                            this.regExpCache[smth] = reg;
                        } catch (error){
                            this.regExpCache[smth] = {
                                indexes : null,
                            };
                        }
                    } else if(reg === null && smth === ''){
                        this.regExpCache[smth] = {
                            indexes : null,
                        };
                    }
                    return reg.indexes === null ? true : (reg.indexes[index] !== void 0);
                }.bind(this);
            case MODES.PERIOD:
                return function (str : string, smth : string) : boolean {
                    return true;
                }.bind(this);
            default:
                return void 0;
        }
    }

    getMatchStr(mode : string){
        let filter = this.dataFilter.value;
        if (typeof filter === 'string' && filter !== ''){
            switch (mode){
                case MODES.TEXT:
                    return filter;
                case MODES.REG:
                    return filter.replace(/[^\d\w,\-\+\|@#$_=]/gi, '');
                case MODES.PERIOD:
                    return '';
                default:
                    return '';
            }
        } else {
            return '';
        }
    }

    filterData(rows: Array<DataRow>, offset: number = 0){
        let processor   = this.getTextParser(this.dataFilter.mode),
            match       = this.getMatchStr(this.dataFilter.mode),
            requestGUID = this.getRequestGUID(this.dataFilter.mode, this.dataFilter.value);
        let result      = processor !== void 0 ? (rows.map((row, index)=>{
            row.filtered    = this.dataFilter.value === '' ? true : processor(row.str, this.dataFilter.value, (index + offset));
            row.match       = match;
            row.matchReg    = this.dataFilter.mode === MODES.REG;
            row.filters     = {};
            row.requests[requestGUID] === void 0 && (row.requests[requestGUID] = row.filtered);
            Object.keys(this.filters).forEach((GUID)=>{
                let filter = this.filters[GUID];
                row.filters[GUID] = filter.value === '' ? true : filter.processor(row.str, filter.value, (index + offset));
            });
            return row;
        })) : null;
        return result !== null ? result : rows;
    }

    getRenderStr(str: string){
        return str;
    }

    getRequestGUID(mode: string, value: string){
        let key = mode + value;
        this.requests[key] === void 0 && (this.requests[key] = GUID.generate());
        return this.requests[key];
    }

    updateForFilter(filter: DataFilter, rows? : Array<any>){
        let processor   = this.getTextParser(filter.mode),
            requestGUID = this.getRequestGUID(filter.mode, filter.value),
            measure     = Logs.measure('[controller.data.ts][updateForFilter]: ' + filter.value),
            target      = rows instanceof Array ? rows : this.data.rows;
        target = processor !== void 0 ? (target.map((row, index)=>{
            if (row.requests[requestGUID] === void 0){
                let filtered    = filter.value === '' ? true : processor(row.str, filter.value, index);
                //row.match       = match;
                row.filters     = {};
                row.matchReg    = filter.mode === MODES.REG;
                row.requests[requestGUID] === void 0 && (row.requests[requestGUID] = filtered);
                Object.keys(this.filters).forEach((GUID)=>{
                    let filter = this.filters[GUID];
                    row.filters[GUID] = filter.value === '' ? true : filter.processor(row.str, filter.value, index);
                });
                return row;
            } else {
                return row;
            }
        })) : target;
        Logs.measure(measure);
    }

    updateForParsers(){
        let measure         = Logs.measure('[controller.data][updateForParsers]'),
            parsers         = new Parsers();
        this.data.rows      = this.data.rows.map((row)=>{
            row.parsed = parsers.parse(row.str);
            return row;
        });
        /*
        * Can be optimized for using list of parser, which should be updated
        * */
        Logs.measure(measure);
    }

    onREMEMBER_FILTER(GUID: string){
        this.filters[GUID]  = {
            value       : this.dataFilter.value,
            mode        : this.dataFilter.mode,
            processor   : this.getTextParser(this.dataFilter.mode)
        };
        this.data.rows      = this.filterData(this.data.rows);
        //console.log('saved for ' + GUID);
    }

    onFORGET_FILTER(GUID: string){
        delete this.filters[GUID];
        this.data.rows = this.filterData(this.data.rows);
        //console.log('removed for ' + GUID);
    }

    onSEARCH_REQUEST_CHANGED(dataFilter: DataFilter){
        this.getRequestGUID(dataFilter.mode, dataFilter.value);
        this.dataFilter     = new DataFilter(dataFilter.mode, dataFilter.value);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_START,   Object.assign({}, this.dataFilter));
        this.data.rows      = this.filterData(this.data.rows);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH,  Object.assign({}, this.dataFilter));
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED, new EVENT_DATA_IS_UPDATED(this.data.rows));
    }

    onTXT_DATA_COME(data : string, callback : Function){
        let measure         = Logs.measure('[controller.data][onTXT_DATA_COME]'),
            rows            = data.match(/[^\r\n]+/g),
            parsers         = new Parsers(),
            total           = 0;
        rows                = rows instanceof Array ? rows : [];
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_RESET);
        this.data.source    = data;
        this.data.indexes   = {};
        this.data.rows      = rows.map((str, index)=>{
            total += str.length + 1;
            this.data.indexes[total] = index;
            return {
                str         : str,
                render_str  : this.getRenderStr(str),
                parsed      : parsers.parse(str),
                filtered    : true,
                match       : '',
                matchReg    : true,
                filters     : {},
                requests    : {}
            };
        });
        this.resetRegExpCache();
        Logs.measure(measure);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED, new EVENT_DATA_IS_UPDATED(this.data.rows));
        typeof callback === 'function' && callback();
    }

    onSTREAM_DATA_UPDATE(data: string){
        if (this.data.rows instanceof Array){
            let rows                = null,
                _rows : Array<any>  = [],
                parsers             = new Parsers(),
                offset              = this.data.rows.length;
            //Check broken line from previous package
            this.stream.broken !== '' && (data = this.stream.broken + data);
            this.stream.broken  = '';
            rows                = data.match(/[^\r\n]+/g);
            if (rows instanceof Array && rows.length > 0){
                //Check current package for broken line
                if (!~data.search(/.(\n|\n\r|\r|\r\n)$/gi)){
                    rows[rows.length - 1] !== '' && (this.stream.broken  = rows[rows.length - 1]);
                    rows[rows.length - 1] !== '' && Logs.msg('Broken line is found. Line excluded from current package and waiting for a next package.', LogTypes.DEBUG);
                    rows.splice(rows.length - 1, 1);
                }
                if (rows.length > 0){
                    if (this.stream.broken === '' && this.data.source !== ''){
                        this.data.source += '\n\r';
                    }
                    //Add data to source
                    this.data.source    += data;
                    //We do not need to reset RegExp Cache
                    //Get parsed data
                    _rows               = this.filterData(rows.map((str)=>{
                        return {
                            str         : str,
                            render_str  : this.getRenderStr(str),
                            parsed      : parsers.parse(str),
                            filtered    : true,
                            match       : '',
                            matchReg    : true,
                            filters     : {},
                            requests    : {}
                        };
                    }), offset);
                    //Get active requests and apply it
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL, (requests:Array<any>)=>{
                        requests instanceof Array && requests.forEach((request: any)=>{
                            if (request.type !== void 0 && request.value !== void 0){
                                dataController.updateForFilter({
                                    mode    : request.type,
                                    value   : request.value
                                }, _rows);
                            }
                        });
                    });
                    //Add data to rows
                    this.data.rows.push(..._rows);
                    //Call event of changing data
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED, new EVENT_DATA_IS_UPDATED(_rows));
                    //console.log(new EVENT_DATA_IS_UPDATED(_rows));
                }
            }
        }
    }

    onSEARCH_REQUEST_RESET(){
        this.dataFilter = new DataFilter(MODES.REG, '');
    }

}

let dataController = new DataController();

export { dataController }

