import { DataFilter } from '../core/interfaces/interface.data.filter.js';

export const WorkerCommands = {
    create              : 'create',
    add                 : 'add',
    addFilter           : 'addFilter',
    addRequest          : 'addRequest',
    removeFilter        : 'removeFilter',
    updateActiveFilter  : 'updateActiveFilter',
    updateParsers       : 'updateParsers'
};

export interface WorkerRequest {
    command     : string,
    event       : string | symbol | Array<string>,
    eventBefore?: string | symbol | Array<string>,
    eventAfter? : string | symbol | Array<string>,
    str?        : string,
    requests?   : Array<any>,
    value?      : string,
    mode?       : string,
    GUID?       : string,
    filter?     : DataFilter,
    rows?       : Array<any>,
    offset?     : number,
    configuration: any
}

export interface WorkerResponse {
    event?          : string | symbol | Array<string>,
    rows?           : Array<any>,
    processedRows?  : Array<any>,
    filter?         : DataFilter,
    command?        : string
}