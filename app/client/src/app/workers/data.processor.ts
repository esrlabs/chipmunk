
import { Logs, TYPES as LogTypes                        } from '../core/modules/tools.logs.js';
import { DataRow                                        } from '../core/interfaces/interface.data.row.js';
import { DataFilter                                     } from '../core/interfaces/interface.data.filter.js';
import { Parsers                                        } from '../core/modules/parsers/controller.data.parsers.js';
import { MODES                                          } from '../core/modules/controller.data.search.modes.js';
import { WorkerCommands, WorkerRequest, WorkerResponse  } from '../workers/data.processor.interfaces.js';

class Helpers {
    static getRequestGUID(mode: string, value: string){
        return mode + value;
    }
}

class Processors {

    private _cache: Object = {};

    constructor() {
        this[MODES.TEXT] = this[MODES.TEXT].bind(this);
        this[MODES.REG] = this[MODES.REG].bind(this);
    }

    getIndexByPosition(fragmentLength: number, indexes: Object, position: number) {
        for (let i = position; i <= fragmentLength; i += 1) {
            if (indexes[i] !== void 0) {
                return {
                    index: indexes[i],
                    start: i
                };
            }
        }
        return {
            index: -1,
            start: -1
        };
    }

    getRegExpMap(fragment: string, smth: string, indexes: Object) : Array<number> {
        let map = [];
        try {
            let regExp          = new RegExp(smth.replace(/\\*$/gi, '').replace(/\\/gi, '\\')  , 'gi');
            let match           = null;
            let index           = null;
            let fragmentLength  = fragment.length;
            do {
                match = regExp.exec(fragment);
                index = null;
                if (match !== null) {
                    index = match.index;
                    index = this.getIndexByPosition(fragmentLength, indexes, index);
                    if (index.index !== -1) {
                        map.push(index.index);
                        regExp.lastIndex < index.start && (regExp.lastIndex = index.start);
                    }
                } else {
                    break;
                }
            } while (true);
        } catch (error){
            map = null;
        }
        return map;
    }

    [MODES.TEXT](str : string, smth : string, position: number, indexes: Object, fragment: string) {
        return ~str.indexOf(smth) ? true : false;
    }

    [MODES.REG](str : string, smth : string, position: number, indexes: Object, fragment: string) {
        let cached = this._cache[smth] !== void 0 ? this._cache[smth] : null;
        if (cached === null && smth !== ''){
            this._cache[smth] = this.getRegExpMap(
                fragment,
                smth,
                indexes
            );
        } else if (cached === null && smth === ''){
            this._cache[smth] = null;
        }
        return this._cache[smth] === null ? true : (this._cache[smth].indexOf(position) !== -1);
    }

    getMatchString(value: string, mode : string){
        let filter = value;
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

    get(mode: string) : Function | null {
        if (this[mode] === void 0) {
            return null;
        }
        return this[mode];
    }

    getCache(){
        return this._cache;
    }

    setCache(cache: Object){
        this._cache = cache;
    }
}

class FragmentReader {

    request(request: DataFilter, rows: Array<DataRow>, indexes: Object, fragment: string, filters: Object) {
        const processors    = new Processors();
        const processor     = processors.get(request.mode);

        const requestGUID   = Helpers.getRequestGUID(request.mode, request.value);

        if (requestGUID === '') {
            return rows;
        }

        const measure       = Logs.measure('[data.processor][Fragment][request]: ' + request.value);

        const result        = rows.map((row, position) => {
            row.requests[requestGUID] = (processor !== null ? processor( row.str, request.value, position, indexes, fragment) : true);
            return row;
        });

        Logs.measure(measure);
        return result !== null ? result : rows;
    }

    filter(filter: DataFilter, rows: Array<DataRow>, indexes: Object, fragment: string, filters: Object, requests: Array<DataFilter>){
        const processors    = new Processors();
        const processor     = processors.get(filter.mode);

        const match         = processors.getMatchString(filter.value, filter.mode);
        const requestGUID   = Helpers.getRequestGUID(filter.mode, filter.value);
        const measure       = Logs.measure('[data.processor][Fragment][filter]: ' + filter.value);

        const result        = rows.map((row, position) => {
            //str : string, smth : string, position: number, indexes: Object, fragment: string
            row.filtered    = filter.value === '' ? true : (processor !== null ? processor( row.str, filter.value, position, indexes, fragment) : true);
            row.match       = match;
            row.matchReg    = filter.mode === MODES.REG;
            row.filters     = {};

            if (row.requests === void 0) {
                row.requests = {};
            }

            if (requestGUID !== '' && filter.value !== '') {
                row.requests[requestGUID] === void 0 && (row.requests[requestGUID] = row.filtered);
            }

            requests.forEach((request: DataFilter) => {
                const GUID = Helpers.getRequestGUID(request.mode, request.value);
                if (row.requests[GUID] === void 0) {
                    const processor = processors.get(request.mode);
                    row.requests[GUID] = request.value === '' ? true : (processor !== null ? processor( row.str, request.value, position, indexes, fragment) : true);
                }
            });

            Object.keys(filters).forEach((GUID)=>{
                const filter    = this.filters[GUID];
                const processor = processors.get(filter.mode);
                row.filters[GUID] = filter.value === '' ? true : (processor !== null ? processor( row.str, filter.value, position, indexes, fragment) : true);
            });

            return row;
        });
        Logs.measure(measure);
        return result !== null ? result : rows;
    }

    filters(rows: Array<DataRow>, activeRequests: Array<any>, indexes: Object, fragment: string, filters: Object){
        if (!(activeRequests instanceof Array)){
            return rows;
        }
        if (!(rows instanceof Array)){
            return rows;
        }
        /*
        activeRequests.forEach((request: any)=>{
            this.filter(request, rows, indexes, fragment, filters, []);
        });
        */
        return rows;
    }

    getRows(fragment: string, filter: DataFilter, filters: Object, requests: Array<DataFilter>) : {rows: Array<DataRow>, indexes: Object, rest: string, fragment: string} {
        const parsers = new Parsers();

        let result : { rows: Array<DataRow>, indexes: Object, rest: string, fragment: string } = {
            rows        : [],
            indexes     : {},
            rest        : '',
            fragment    : ''
        };

        let rows = typeof fragment === 'string' ? fragment.match(/[^\r\n]+/g) : null;

        if (!(rows instanceof Array) || rows.length === 0) {
            return result;
        }

        //Check current package for broken line
        if (!~fragment.search(/.(\n|\n\r|\r|\r\n)$/gi)){
            rows[rows.length - 1] !== '' && (result.rest  = rows[rows.length - 1]);
            rows[rows.length - 1] !== '' && Logs.msg('Broken line is found. Line excluded from current package and waiting for a next package.', LogTypes.DEBUG);
            rows.splice(rows.length - 1, 1);
        }

        if (rows.length === 0) {
            return result;
        }

        //Build indexes
        let totalLength = 0;
        rows.forEach((str, index) => {
            totalLength += str.length;
            result.indexes[totalLength] = index;
        });

        //Remove breaks: we don't need it anymore, because we have indexes
        result.fragment = fragment.replace(/[\r\n]/gi, '');

        //Get rows
        result.rows = this.filter(filter, rows.map((str)=>{
            return {
                str         : str,
                parsed      : parsers.parse(str),
                filtered    : true,
                match       : '',
                matchReg    : true,
                filters     : {},
                requests    : {}
            };
        }), result.indexes, result.fragment, filters, requests);
        return result;
    }

}

class Stream {
    private _source         : string            = '';
    private _rows           : Array<DataRow>    = [];
    private _indexes        : Object            = {};
    private _rest           : string            = '';
    private _filters        : Object            = {};
    private _activeFilter   : DataFilter        = { mode: '', value: ''};
    private _requests       : Object            = {};

    private _reset(){
        this._rows      = [];
        this._indexes   = {};
        this._source    = '';
        this._rest      = '';
    }

    private _create(fragment: string, activeRequests: Array<DataFilter>): Array<DataRow>{
        const measure   = Logs.measure('[data.processor][Stream][create]');
        const reader    = new FragmentReader();

        const result    = reader.getRows(fragment, this._activeFilter, this._filters, activeRequests);

        this._rows      = result.rows;
        this._indexes   = result.indexes;
        this._source    = result.fragment;

        Logs.measure(measure);

        return this._rows;
    }

    private _add(fragment: string, activeRequests: Array<DataFilter>): Array<DataRow>{
        const measure       = Logs.measure('[data.processor][Stream][add]');
        const reader        = new FragmentReader();

        const result        = reader.getRows(this._rest + fragment, this._activeFilter, this._filters, activeRequests);

        const offsetRows    = this._rows.length;
        const offsetLength  = this._source.length;

        //Add rows
        this._rows.push(...result.rows);
        //Add indexes
        Object.keys(result.indexes).forEach((key) => {
            this._indexes[parseInt(key) + offsetLength] = result.indexes[key] + offsetRows;
        });
        //Update rest
        this._rest      = result.rest;
        //Update source
        this._source    += result.fragment;

        Logs.measure(measure);

        return result.rows;
    }

    private _updateFilters(){
        const measure       = Logs.measure('[data.processor][Stream][applyFilter]');
        const reader        = new FragmentReader();
        this._rows          = reader.filter(null, this._rows, this._indexes, this._source, this._filters, []);
        Logs.measure(measure);
        return true;
    }

    private _updateActiveFilter(filter: DataFilter){
        const measure       = Logs.measure('[data.processor][Stream][updateActiveFilter]');
        const reader        = new FragmentReader();
        this._activeFilter  = filter;
        this._rows          = reader.filter(filter, this._rows, this._indexes, this._source, this._filters, []);
        Logs.measure(measure);
        return true;
    }

    private _addRequest(request: DataFilter){
        const reader        = new FragmentReader();
        const GUID          = Helpers.getRequestGUID(request.mode, request.value);
        if (request.value !== '' && this._requests[GUID] === void 0) {
            const measure       = Logs.measure('[data.processor][Stream][addRequest]');
            this._requests[GUID]= request;
            this._rows          = reader.filter(this._activeFilter, this._rows, this._indexes, this._source, this._filters, Object.keys(this._requests).map((GUID) => {
                return this._requests[GUID];
            }));
            Logs.measure(measure);
        }

        return true;
    }

    private _updateParsers(){
        const measure   = Logs.measure('[data.processor][updateParsers]');
        const parsers   = new Parsers();

        this._rows = this._rows.map((row)=>{
            row.parsed = parsers.parse(row.str);
            return row;
        });

        Logs.measure(measure);

        /*
        * Can be optimized for using list of parser, which should be updated
        * */
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Promises wrappers
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    create(fragment: string, activeRequests: Array<any>){
        return new Promise((resolve, reject) => {
            resolve(this._create(fragment, activeRequests));
        });
    }

    add(fragment: string, activeRequests: Array<any>){
        return new Promise((resolve, reject) => {
            resolve(this._add(fragment, activeRequests));
        });
    }

    addFilter(mode: string, value: string) : boolean{
        if (this._filters[Helpers.getRequestGUID(mode, value)] !== void 0){
            return false;
        }
        this._filters[Helpers.getRequestGUID(mode, value)] = {
            mode    : mode,
            value   : value
        };
        return true;
    }

    removeFilter(ID: string) : boolean {
        if (this._filters[ID] === void 0) {
            return false;
        }
        delete this._filters[ID];
        return true;
    }

    updateFilters(){
        return new Promise((resolve, reject) => {
            const result = this._updateFilters();
            result && resolve(this._rows);
            !result && reject();
        });
    }

    updateActiveFilter(filter: DataFilter){
        return new Promise((resolve, reject) => {
            this._updateActiveFilter(filter);
            resolve(this._rows);
        });
    }

    addRequest(request: DataFilter){
        return new Promise((resolve, reject) => {
            this._addRequest(request);
            resolve(this._rows);
        });
    }


    updateParsers(){
        return new Promise((resolve, reject) => {
            this._updateParsers();
            resolve(this._rows);
        });
    }

}

const stream = new Stream();

var Configuration = {};

onmessage = function(event: MessageEvent) {
    let request = event.data as WorkerRequest;

    if (typeof request !== 'object' || request === null) {
        return false;
    }

    request.event           = request.event         === void 0 ? null : request.event;
    request.eventBefore     = request.eventBefore   === void 0 ? null : request.eventBefore;
    request.eventAfter      = request.eventAfter    === void 0 ? null : request.eventAfter;

    if (request.configuration !== void 0) {
        //Worker doesn't have access to window object and doesn't have access to localStorage as result.
        //So, we provides settings via parameters of event and as glo al object
        Configuration = request.configuration;
    }

    request.eventBefore !== null && postMessage.call(this, {
        event   : request.eventBefore
    } as WorkerResponse);

    switch (request.command) {
        case WorkerCommands.create:
            stream.create(request.str, [])
                .then((rows)=>{
                    request.eventAfter !== null && postMessage.call(this, {
                        event   : request.eventAfter
                    } as WorkerResponse);
                    postMessage.call(this, {
                        event   : request.event,
                        rows    : rows
                    } as WorkerResponse);
                });
            break;
        case WorkerCommands.add:
            stream.add(request.str, request.requests)
                .then((rows)=>{
                    request.eventAfter !== null && postMessage.call(this, {
                        event   : request.eventAfter
                    } as WorkerResponse);
                    postMessage.call(this, {
                        event           : request.event,
                        processedRows   : rows
                    } as WorkerResponse);
                });
            break;
        case WorkerCommands.addFilter:
            if (stream.addFilter(request.value, request.mode)) {
                stream.updateFilters().then((rows)=>{
                    request.eventAfter !== null && postMessage.call(this, {
                        event   : request.eventAfter
                    } as WorkerResponse);
                    postMessage.call(this, {
                        event   : request.event,
                        rows    : rows
                    } as WorkerResponse);
                });
            } else {
                //TODO: not clear, should we return smth or can do not do it at all
            }
            break;
        case WorkerCommands.addRequest:
            stream.addRequest(request.filter).then((rows)=>{
                request.eventAfter !== null && postMessage.call(this, {
                    event   : request.eventAfter
                } as WorkerResponse);
                postMessage.call(this, {
                    event   : request.event,
                    rows    : rows
                } as WorkerResponse);
            });
            break;
        case WorkerCommands.removeFilter:
            if (stream.removeFilter(request.GUID)) {
                stream.updateFilters().then((rows)=>{
                    request.eventAfter !== null && postMessage.call(this, {
                        event   : request.eventAfter
                    } as WorkerResponse);
                    postMessage.call(this, {
                        event   : request.event,
                        rows    : rows
                    } as WorkerResponse);
                });
            } else {
                //TODO: not clear, should we return smth or can do not do it at all
            }
            break;
        case WorkerCommands.updateActiveFilter:
            stream.updateActiveFilter(request.filter)
                .then((rows)=>{
                    request.eventAfter !== null && postMessage.call(this, {
                        event   : request.eventAfter
                    } as WorkerResponse);
                    postMessage.call(this, {
                        event   : request.event,
                        rows    : rows
                    } as WorkerResponse);
                });
            break;
        case WorkerCommands.updateParsers:
            stream.updateParsers()
                .then((rows)=>{
                    request.eventAfter !== null && postMessage.call(this, {
                        event   : request.eventAfter
                    } as WorkerResponse);
                    postMessage.call(this, {
                        event   : request.event,
                        rows    : rows
                    } as WorkerResponse);
                });
            break;

    }

};

