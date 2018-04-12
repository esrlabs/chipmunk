import { Logs, TYPES as LogTypes                            } from './tools.logs';
import { DataRow                                            } from '../interfaces/interface.data.row';
import { DataFilter                                         } from '../interfaces/interface.data.filter';
import { Parsers                                            } from './parsers/controller.data.parsers';
import { MODES                                              } from './controller.data.search.modes';
import { IWorkerResponse, TFiltersMatches, TRequestsMatches } from '../../workers/data.processor.interfaces.js';
import { WorkerController                                   } from './controller.data.worker';
import {IOutputSettings, ISettings, settings as Settings} from '../modules/controller.settings';

type TFilters       = {[key: string] : DataFilter   };
type TRequests      = {[key: string] : DataFilter   };
type TFilterHashes  = {[key: string] : number       };
type TMatches       = {[key: string] : number       };

class Helpers {
    static getRequestGUID(mode: string, value: string){
        return mode + value;
    }
}

class FilterHashes {

    private filters : TFilters       = {};
    private hash    : TFilterHashes  = {};

    public setHash(filters: TFilters, length: number){
        this.filters    = filters;
        this.hash       = this.getHash(filters, length);
    }

    public isSame(filters: TFilters, length: number): boolean {
        return this.getNotMatched(filters, length).length === 0;
    }

    public getNotMatched(filters: TFilters, length: number) : Array<string> {
        let hash = this.getHash(filters, length);
        let result: Array<string> = Object.keys(hash).map((GUID: string) => {
            if (this.hash[GUID] === void 0) {
                return GUID;
            }
            if (this.hash[GUID] !== hash[GUID]) {
                return GUID;
            }
            return '';
        }).filter((GUID) => {
            return GUID !== '';
        });
        return result;
    }

    public getHash(filters: TFilters, length: number): TFilterHashes{
        let hash = {};
        Object.keys(filters).forEach((GUID: string) => {
            hash[GUID] = length;
        });
        return hash;
    }

}

class Stream {
    private _rows           : Array<DataRow>    = [];
    private _rest           : string            = '';
    private _requests       : TRequests         = {};
    private _filters        : TFilters          = {};
    private _filter         : DataFilter        = { mode: '', value: '' };
    private _filtersHash    : FilterHashes      = new FilterHashes();
    private _requestsHash   : FilterHashes      = new FilterHashes();
    private _worker         : WorkerController  = new WorkerController();
    private _settings       : ISettings | null  = null;

    constructor(){
    }

    private _getDefaultOutputSettings(): IOutputSettings{
        return {
            remove_empty_rows_from_stream: true
        }
    }

    private _getOutputSettings(): IOutputSettings {
        if (typeof this._settings !== 'object' || this._settings === null){
            this._settings = Settings.get();
        }
        if (this._settings.output === void 0 || this._settings.output === null){
            this._settings = null;
            return this._getDefaultOutputSettings();
        }
        return this._settings.output;
    }

    private _reset(){
        this._rows          = [];
        this._rest          = '';
        this._requests      = {};
        this._filters       = {};
        this._filtersHash   = new FilterHashes();
        this._requestsHash  = new FilterHashes();
    }

    private _getRows(fragment: string) : { rows: Array<DataRow>, rest: string, fragment: string} {
        const parsers = new Parsers();
        const measure = Logs.measure('[data.processor][Stream][_getRows]');

        const outputSettings = this._getOutputSettings();

        let result = {
            rows    : [] as Array<DataRow>,
            rest    : '',
            fragment: ''
        };

        fragment = typeof fragment === 'string' ? fragment.replace(/\r?\n|\r/gi, '\n') : fragment;

        let rows = typeof fragment === 'string' ? fragment.split(/\n/gi) : null;

        //Remove empty stuff
        if (outputSettings.remove_empty_rows_from_stream){
            rows instanceof Array && (rows = rows.filter((str)=>{ return str !== ''; }));
        } else {
            rows instanceof Array && (rows = rows.map((str)=>{ return str === '' ? ' ' : str; }));
        }

        if (!(rows instanceof Array) || rows.length === 0) {
            return result;
        }


        //Check current package for broken line
        if (!~fragment.search(/(\n|\n\r|\r|\r\n)$/gi)){
            if (rows.length > 0 && rows[rows.length - 1] !== '') {
                result.rest  = rows[rows.length - 1];
                Logs.msg('Broken line is found. Line excluded from current package and waiting for a next package.', LogTypes.DEBUG);
                rows.splice(rows.length - 1, 1);
            }
        }

        if (rows.length > 0 && rows[rows.length - 1].length === 0){
            rows.splice(rows.length - 1, 1);
        }

        result.fragment = rows.join('\n');

        if (rows.length === 0) {
            return result;
        }

        //Build rows
        result.rows = rows.map((str: string) => {
            return {
                str         : str,
                parsed      : parsers.parse(str),
                filtered    : true,
                match       : '',
                matchReg    : true,
                filters     : {},
                requests    : {}
            };
        });
        Logs.measure(measure);
        return result;
    }

    private _getMatchString(value: string, mode : string){
        let filter = value;
        if (typeof filter === 'string' && filter !== ''){
            switch (mode){
                case MODES.TEXT:
                    return filter;
                case MODES.REG:
                    return filter;
                case MODES.PERIOD:
                    return '';
                default:
                    return '';
            }
        } else {
            return '';
        }
    }

    private _applyAll(rows: Array<DataRow>, filter: DataFilter, filters: TFilters, requests: TRequests) : Promise<Array<DataRow>> {
        return new Promise <Array<DataRow>> ((resolve, reject) => {
            const measure = Logs.measure('[data.processor][Stream][_applyAll]');
            this._worker.post({
                command : this._worker.COMMANDS.apply,
                filter  : filter.value === '' ? null : filter,
                filters : filters,
                requests: requests
            }).then((response: IWorkerResponse) => {
                const results : {
                    filter  : TMatches,
                    filters : TFiltersMatches,
                    requests: TRequestsMatches
                } = {
                    filter  : response.filter,
                    filters : response.filters,
                    requests: response.requests
                };
                const match = this._getMatchString(filter.value, filter.mode);
                //Get GUIDs
                const GUIDsRequests = Object.keys(results.requests);
                const GUIDsFilters = Object.keys(results.filters);
                //Update rows
                rows = rows.map((row: DataRow, position: number) => {
                    //Filtered / Not filtered
                    if (results.filter) {
                        row.filtered = results.filter[position] !== void 0;
                    } else {
                        row.filtered = true;
                    }
                    if (row.filtered) {
                        row.match       = match;
                        row.matchReg    = filter.mode === MODES.REG;
                    } else {
                        row.match       = '';
                        row.matchReg    = true;
                    }
                    //Filters
                    row.filters = {};
                    GUIDsFilters.forEach((GUID) => {
                        row.filters[GUID] = results.filters[GUID][position] !== void 0;
                    });
                    //Requests
                    row.requests = {};
                    GUIDsRequests.forEach((GUID) => {
                        row.requests[GUID] = results.requests[GUID][position] !== void 0;
                    });
                    return row;
                });
                Logs.measure(measure);
                resolve(rows);
            }).catch((error)=>{
                Logs.msg(`[_apply]: error: ${error.message}`, LogTypes.ERROR);
            });
        });
    }

    private _applyTo(fragment: string, rows: Array<DataRow>, filter: DataFilter, filters: TFilters, requests: TRequests) : Promise<Array<DataRow>> {
        return new Promise <Array<DataRow>> ((resolve, reject) => {
            const measure = Logs.measure('[data.processor][Stream][_applyAll]');
            const filterGUID = Helpers.getRequestGUID(filter.mode, filter.value);
            this._worker.post({
                command : this._worker.COMMANDS.applyTo,
                filter  : filter.value === '' ? null : filter,
                filters : filters,
                requests: requests,
                str     : fragment
            }).then((response: IWorkerResponse) => {
                const results : {
                    filter  : TMatches,
                    filters : TFiltersMatches,
                    requests: TRequestsMatches
                } = {
                    filter  : response.filter,
                    filters : response.filters,
                    requests: response.requests
                };
                const match = this._getMatchString(filter.value, filter.mode);
                //Get GUIDs
                const GUIDsRequests = Object.keys(results.requests);
                const GUIDsFilters = Object.keys(results.filters);
                //Update rows
                rows = rows.map((row: DataRow, position: number) => {
                    //Filters
                    row.filters = {};
                    GUIDsFilters.forEach((GUID) => {
                        row.filters[GUID] = results.filters[GUID][position] !== void 0;
                    });
                    //Requests
                    row.requests = {};
                    GUIDsRequests.forEach((GUID) => {
                        row.requests[GUID] = results.requests[GUID][position] !== void 0;
                    });
                    //Filtered / Not filtered
                    if (results.filter) {
                        row.filtered = results.filter[position] !== void 0;
                    } else {
                        row.filtered = true;
                    }
                    if (row.filtered) {
                        row.match                   = match;
                        row.matchReg                = filter.mode === MODES.REG;
                        row.requests[filterGUID]    = true;
                    } else {
                        row.match                   = '';
                        row.matchReg                = true;
                        row.requests[filterGUID]    = false;
                    }
                    return row;
                });
                Logs.measure(measure);
                resolve(rows);
            }).catch((error)=>{
                Logs.msg(`[_applyTo]: error: ${error.message}`, LogTypes.ERROR);
            });
        });
    }

    private _applyFilter(rows: Array<DataRow>) : Promise<Array<DataRow>> {
        return new Promise <Array<DataRow>> ((resolve, reject) => {
            const measure = Logs.measure('[data.processor][Stream][_applyFilter]');
            const filterGUID = Helpers.getRequestGUID(this._filter.mode, this._filter.value);
            this._worker.post({
                command : this._worker.COMMANDS.filter,
                filter  : this._filter.value === '' ? null : this._filter
            }).then((response: IWorkerResponse) => {
                const results : TMatches = response.filter;
                const match = this._getMatchString(this._filter.value, this._filter.mode);
                //Update rows
                rows = rows.map((row: DataRow, position: number) => {
                    //Filtered / Not filtered
                    if (results) {
                        row.filtered = results[position] !== void 0;
                    } else {
                        row.filtered = true;
                    }
                    if (row.filtered) {
                        row.match                   = match;
                        row.matchReg                = this._filter.mode === MODES.REG;
                        row.requests[filterGUID]    = true;
                    } else {
                        row.match                   = '';
                        row.matchReg                = true;
                        row.requests[filterGUID]    = false;
                    }
                    return row;
                });
                Logs.measure(measure);
                resolve(rows);
            }).catch((error)=>{
                Logs.msg(`[_applyFilter]: error: ${error.message}`, LogTypes.ERROR);
            });
        });
    }

    private _applyFilters(rows: Array<DataRow>, filters: TFilters) : Promise<Array<DataRow>> {
        return new Promise <Array<DataRow>> ((resolve, reject) => {
            const measure = Logs.measure('[data.processor][Stream][_applyFilters]');
            this._worker.post({
                command : this._worker.COMMANDS.filters,
                filters : filters
            }).then((response: IWorkerResponse) => {
                const results : TFiltersMatches = response.filters;
                const GUIDs = Object.keys(results);
                //Update rows
                rows = rows.map((row: DataRow, position: number) => {
                    //Filters
                    row.filters = {};
                    GUIDs.forEach((GUID) => {
                        row.filters[GUID] = results[GUID][position] !== void 0;
                    });
                    return row;
                });
                Logs.measure(measure);
                resolve(rows);
            }).catch((error)=>{
                Logs.msg(`[_applyFilters]: error: ${error.message}`, LogTypes.ERROR);
            });
        });
    }

    private _applyRequests(rows: Array<DataRow>, requests: TRequests) : Promise<Array<DataRow>>{
        return new Promise <Array<DataRow>> ((resolve, reject) => {
            const measure = Logs.measure('[data.processor][Stream][_applyRequests]');
            //Add active search request
            let filterGUID;
            if (this._filter.value !== '') {
                filterGUID = Helpers.getRequestGUID(this._filter.mode, this._filter.value);
                requests[filterGUID] === void 0 && (requests[filterGUID] = {
                    mode    : this._filter.mode,
                    value   : this._filter.value
                });
            } else {
                filterGUID = null;
            }
            this._worker.post({
                command     : this._worker.COMMANDS.requests,
                requests    : requests
            }).then((response: IWorkerResponse) => {
                const results : TFiltersMatches = response.requests;
                const GUIDs = Object.keys(results);
                //Update rows
                rows = rows.map((row: DataRow, position: number) => {
                    //Requests
                    row.requests = {};
                    GUIDs.forEach((GUID: string) => {
                        row.requests[GUID] = results[GUID][position] !== void 0;
                    });
                    return row;
                });
                Logs.measure(measure);
                resolve(rows);
            }).catch((error)=>{
                Logs.msg(`[_applyRequests]: error: ${error.message}`, LogTypes.ERROR);
            });
        });
    }

    private _convertRequestArrayToObject(requestsArray: Array<DataFilter>): TRequests {
        let result : TRequests = {};
        requestsArray.forEach((request: DataFilter) => {
            const GUID = Helpers.getRequestGUID(request.mode, request.value);
            result[GUID] = request;
        });
        return result;
    }

    public create(fragment: string, activeRequests: Array<DataFilter>) : Promise<Array<DataRow>>{
        return new Promise <Array<DataRow>> ((resolve, reject) => {
            this._reset();
            //Build rows
            const measure   = Logs.measure('[data.processor][Stream][create]');
            const result    = this._getRows(fragment);
            this._rows      = result.rows;
            //Call worker
            this._worker.post({
                command : this._worker.COMMANDS.create,
                str     :result.fragment
            }).then(() => {
                //Apply all filters
                this._applyAll(this._rows, this._filter, this._filters, this._convertRequestArrayToObject(activeRequests))
                    .then((rows: Array<DataRow>)=>{
                        Logs.measure(measure);
                        resolve(rows);
                    }).catch((error)=>{
                    Logs.msg(`[create]: error: ${error.message}`, LogTypes.ERROR);
                });
            });
        });
    }

    public add(fragment: string, activeRequests: Array<DataFilter>) : Promise <Array<DataRow>> {
        return new Promise <Array<DataRow>> ((resolve, reject) => {
            const measure = Logs.measure('[data.processor][Stream][add]');
            //Attach rest from previous iteration
            fragment = this._rest + fragment;
            //Build rows
            const result = this._getRows(fragment);
            //Save rest of current iteration
            this._rest = result.rest;
            //Apply filters
            this._applyTo(result.fragment, result.rows, this._filter, this._filters, this._convertRequestArrayToObject(activeRequests))
                .then((rows: Array<DataRow>) => {
                    this._rows.push(...rows);
                    //Call worker
                    this._worker.post({
                        command : this._worker.COMMANDS.add,
                        str     :result.fragment
                    }).then(() => {
                        resolve(rows);
                    });
                });
        });
    }

    public addFilter(filter: DataFilter) : Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            if (this._filters[Helpers.getRequestGUID(filter.mode, filter.value)] !== void 0){
                return resolve(false);
            }
            this._filters[Helpers.getRequestGUID(filter.mode, filter.value)] = {
                mode    : filter.mode,
                value   : filter.value
            };
            return resolve(true);
        });
    }

    public removeFilter(ID: string) : Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            if (this._filters[ID] === void 0) {
                return resolve(false);
            }
            delete this._filters[ID];
            return resolve(true);
        });

    }

    public updateFilters() : Promise<Array<DataRow>> {
        return this._applyFilters(this._rows, this._filters);
    }

    public updateActiveFilter(filter: DataFilter) : Promise<Array<DataRow>> {
        this._filter = filter;
        return this._applyFilter(this._rows);
    }

    public addRequest(request: DataFilter) : Promise<Array<DataRow>> {
        return new Promise((resolve, reject) => {
            if (request.value !== '') {
                const GUID = Helpers.getRequestGUID(request.mode, request.value);
                if (request.value !== '') {
                    this._requests[GUID] = request;
                    if (!this._requestsHash.isSame(this._requests, this._rows.length)) {
                        this._requestsHash.setHash(this._requests, this._rows.length);
                        return this._applyRequests(this._rows, this._requests).then(resolve).catch((error)=>{
                            Logs.msg(`[addRequest]: error: ${error.message}`, LogTypes.ERROR);
                        });
                    }
                }
            }
            resolve(this._rows);
        });
    }

    public updateParsers() : Promise<Array<DataRow>> {
        return new Promise((resolve, reject) => {
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
            resolve(this._rows);
        });
    }

    public getRows() : Array<DataRow>{
        return this._rows;
    }

    public getFilters() : Object{
        return this._filters;
    }

    public getRequests() : Object{
        return this._requests;
    }

}

export { Stream }