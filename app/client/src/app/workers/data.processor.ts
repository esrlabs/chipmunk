import { DataFilter                                                         } from '../core/interfaces/interface.data.filter.js';
import { MODES                                                              } from '../core/modules/controller.data.search.modes.js';
import { WORKER_COMMANDS, IWorkerRequest, IWorkerResponse,
    TMatches, TRequestsMatches, TFiltersMatches, TFilters, TRequests   } from '../workers/data.processor.interfaces.js';
import { StringsCollection                                                  } from './data.processor.strings.js';

class StringsCollectionWrapper {

    private _collection : StringsCollection = new StringsCollection();

    public create(fragment: string) {
        return new Promise((resolve, reject) => {
            this._collection = new StringsCollection();
            this._collection.addFragment(fragment);
            resolve();
        });
    }

    public add(fragment: string) {
        return new Promise((resolve, reject) => {
            this._collection.addFragment(fragment);
            resolve();
        });
    }

    public applyTo(fragment: string, filter: DataFilter, filters: TFilters, requests: TRequests) : Promise <{ filter: TMatches, filters : TFiltersMatches, requests: TRequestsMatches}> {
        return new Promise <{ filter: TMatches, filters : TFiltersMatches, requests: TRequestsMatches}>((resolve, reject) => {
            let collection = new StringsCollection();
            collection.addFragment(fragment);
            this.apply(filter, filters, requests, collection)
                .then((result) => {
                    resolve(result);
                    collection = null;
                });
        });
    }

    public apply(filter: DataFilter, filters: TFilters, requests: TRequests, collection?: StringsCollection) : Promise <{ filter: TMatches, filters : TFiltersMatches, requests: TRequestsMatches}> {
        const _collection = collection !== void 0 ? collection : this._collection;
        return new Promise <{ filter: TMatches , filters : TFiltersMatches, requests: TRequestsMatches}>((resolve, reject) => {
            const results : {
                filter  : TMatches,
                filters : TFiltersMatches,
                requests: TRequestsMatches
            } = {
                filter  : {},
                filters : {},
                requests: {}
            };
            //Get filter results
            if (filter !== null && filter !== undefined){
                results.filter = _collection.find(filter.value, filter.mode === MODES.REG);
            } else {
                results.filter = {};
            }
            //Get results for each request
            if (requests !== null && requests !== undefined){
                Object.keys(requests).forEach((GUID)=>{
                    const request = requests[GUID];
                    results.requests[GUID] = _collection.find(request.value, request.mode === MODES.REG);
                });
            } else {
                results.requests = {};
            }
            //Get results for each filter
            Object.keys(filters).forEach((GUID)=>{
                const filter = filters[GUID];
                results.filters[GUID] = _collection.find(filter.value, filter.mode === MODES.REG);
            });
            resolve(results);
        });
    }

    public filter(filter: DataFilter) : Promise<TMatches> {
        return new Promise<TMatches>((resolve, reject) => {
            let results : TMatches = {};
            if (filter !== null){
                results = this._collection.find(filter.value, filter.mode === MODES.REG);
            }
            resolve(results);
        });
    }

    public filters(filters: TFilters) : Promise<TFiltersMatches> {
        return new Promise<TFiltersMatches>((resolve, reject) => {
            let results : TFiltersMatches = {};
            Object.keys(filters).forEach((GUID)=>{
                const filter = filters[GUID];
                results[GUID] = this._collection.find(filter.value, filter.mode === MODES.REG);
            });
            resolve(results);
        });
    }

    public requests(requests: TRequests) : Promise<TRequestsMatches> {
        return new Promise<TRequestsMatches>((resolve, reject) => {
            let results : TRequestsMatches = {};
            Object.keys(requests).forEach((GUID)=>{
                const request = requests[GUID];
                results[GUID] = this._collection.find(request.value, request.mode === MODES.REG);
            });
            resolve(results);
        });
    }

}

const stringsCollectionWrapper = new StringsCollectionWrapper();

onmessage = function(event: MessageEvent) {
    let request = event.data as IWorkerRequest;

    if (typeof request !== 'object' || request === null) {
        return false;
    }

    switch (request.command) {
        case WORKER_COMMANDS.create:
            stringsCollectionWrapper.create(request.str)
                .then(()=>{
                    postMessage.call(this, {
                        sequenceID: request.sequenceID
                    } as IWorkerResponse);
                });
            break;
        case WORKER_COMMANDS.add:
            stringsCollectionWrapper.add(request.str)
                .then(()=>{
                    postMessage.call(this, {
                        sequenceID: request.sequenceID
                    } as IWorkerResponse);
                });
            break;
        case WORKER_COMMANDS.apply:
            stringsCollectionWrapper.apply(request.filter, request.filters, request.requests)
                .then((results: { filter: TMatches , filters : TFiltersMatches, requests: TRequestsMatches})=>{
                    postMessage.call(this, {
                        sequenceID  : request.sequenceID,
                        filter      : results.filter,
                        filters     : results.filters,
                        requests    : results.requests

                    } as IWorkerResponse);
                });
            break;
        case WORKER_COMMANDS.applyTo:
            stringsCollectionWrapper.applyTo(
                request.str, 
                request.filter !== void 0 ? request.filter : null, 
                request.filters !== void 0 ? request.filters : {}, 
                request.requests !== void 0 ? request.requests : {})
                .then((results: { filter: TMatches , filters : TFiltersMatches, requests: TRequestsMatches})=>{
                    postMessage.call(this, {
                        sequenceID  : request.sequenceID,
                        filter      : results.filter,
                        filters     : results.filters,
                        requests    : results.requests

                    } as IWorkerResponse);
                });
            break;
        case WORKER_COMMANDS.filter:
            stringsCollectionWrapper.filter(request.filter)
                .then((results: TMatches)=>{
                    postMessage.call(this, {
                        sequenceID  : request.sequenceID,
                        filter      : results

                    } as IWorkerResponse);
                });
            break;
        case WORKER_COMMANDS.filters:
            stringsCollectionWrapper.filters(request.filters)
                .then((results: TFiltersMatches)=>{
                    postMessage.call(this, {
                        sequenceID  : request.sequenceID,
                        filters     : results

                    } as IWorkerResponse);
                });
            break;
        case WORKER_COMMANDS.requests:
            stringsCollectionWrapper.requests(request.requests)
                .then((results: TRequestsMatches)=>{
                    postMessage.call(this, {
                        sequenceID  : request.sequenceID,
                        requests    : results

                    } as IWorkerResponse);
                });
            break;
    }

};

(function(){
    postMessage.call(this, {
        message     : 'ready',
        sequenceID  : -1
    } as IWorkerResponse);
}());

