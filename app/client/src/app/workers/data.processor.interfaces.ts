import { DataFilter } from '../core/interfaces/interface.data.filter.js';

export type TFilters            = { [key: string]       : DataFilter  };
export type TRequests           = { [key: string]       : DataFilter  };
export type TFilterHashes       = { [key: string]       : number      };
export type TMatches            = { [position: number]  : number      };
export type TRequestsMatches    = { [key: string]       : TMatches    };
export type TFiltersMatches     = { [key: string]       : TMatches    };

export const WORKER_COMMANDS = {
    create              : 'create',
    add                 : 'add',
    apply               : 'apply',
    applyTo             : 'applyTo',
    filter              : 'filter',
    filters             : 'filters',
    requests            : 'requests',
    getMatches          : 'getMatches'
};

export interface IWorkerRequest {
    sequenceID? : number,
    command     : string,
    str?        : string,
    filter?     : DataFilter,
    filters?    : TFilters,
    requests?   : TRequests
}


export interface IWorkerResponse {
    sequenceID  : number,
    message?    : string,
    filter?     : TMatches,
    filters?    : TFiltersMatches,
    requests?   : TRequestsMatches
}
