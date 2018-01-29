import { InitiableModule                } from '../interfaces/interface.module.initiable';
import { Logs, TYPES as LogTypes        } from './tools.logs';
import { events as Events               } from './controller.events';
import { configuration as Configuration } from './controller.config';
import { DataRow                        } from '../interfaces/interface.data.row';
import { DataFilter                     } from '../interfaces/interface.data.filter';
import { MODES                          } from './controller.data.search.modes';
import { GUID                           } from './tools.guid';
import { EVENT_DATA_IS_UPDATED          } from '../interfaces/events/DATA_IS_UPDATE';
import { WorkerCommands, WorkerRequest, WorkerResponse  } from '../../workers/data.processor.interfaces';


const RegSrcMarks = {
    BEGIN   : '\u001D',
    END     : '\u001E',
    NUMBER  : '\\\u001D\\d+\\\u001E',
    SELECTOR: /\u001D(\d*)\u001E/gi
};

class DataController implements InitiableModule{
    private dataFilter  : DataFilter        = new DataFilter();
    private requests    : Object            = {};
    private data        : {
        source  : string,
        rows    : Array<DataRow>,
        srcRegs : string
    } = {
        source  : '',
        rows    : [],
        srcRegs : ''
    };
    private stream      : {
        broken  : string
    } = {
        broken  : ''
    };
    private filters         : Object = {};
    private regExpCache     : Object = {};
    private indexesCache    : Object = {};
    private worker          : Worker = new Worker('./app/workers/data.processor.loader.js');
    private workerJobs      : number = 0;

    constructor(){
    }

    private bindEvents(){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,    this.onSEARCH_REQUEST_CHANGED.  bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,             this.onTXT_DATA_COME.           bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE,        this.onSTREAM_DATA_UPDATE.      bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.REMEMBER_FILTER,           this.onREMEMBER_FILTER.         bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.FORGET_FILTER,             this.onFORGET_FILTER.           bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_RESET,      this.onSEARCH_REQUEST_RESET.    bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_OUTPUT_IS_CLEARED,    this.onVIEW_OUTPUT_IS_CLEARED.  bind(this));
        this.worker.addEventListener('message', this.onWorkerMessage.bind(this));
    }

    private onWorkerMessage(event: MessageEvent) {
        let response = event.data as WorkerResponse;
        (response.rows !== void 0) && (this.data.rows = response.rows);
        switch (response.event){
            case Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED:
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED, new EVENT_DATA_IS_UPDATED(response.rows));
                break;
            case Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED:
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED, new EVENT_DATA_IS_UPDATED(response.processedRows));
                break;
            case Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_START:
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_START, response.filter);
                break;
            case Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH:
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH, response.filter);
                break;
            case Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED:
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED, new EVENT_DATA_IS_UPDATED(response.rows));
                break;
            case Configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED:
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED, response.rows);
                break;
        }

        this.workerJobs -= 1;

        if (response.command === 'ready') {
            this.workerJobs = 0;
        }

        this.workerJobs === 0 && Events.trigger(Configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_HIDE);
    }

    private sendWorkerMessage(message: WorkerRequest){
        this.workerJobs === 0 && Events.trigger(Configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_SHOW);
        this.workerJobs += 1;
        this.worker.postMessage(message);
    }

    public init(callback : Function = null){
        Logs.msg('[controller.data] Initialization.', LogTypes.DEBUG);
        this.bindEvents();
        typeof callback === 'function' && callback();
        Logs.msg('[controller.data] Finished.', LogTypes.DEBUG);
    }

    public getRows(){
        return this.data.rows;
    }

    getRequestGUID(mode: string, value: string){
        let key = mode + value;
        //this.requests[key] === void 0 && (this.requests[key] = GUID.generate());
        this.requests[key] === void 0 && (this.requests[key] = key);
        return this.requests[key];
    }

    updateForParsers(){
        this.sendWorkerMessage({
            command : WorkerCommands.updateParsers,
            configuration : this.getConfigurationForWorker()
        } as WorkerRequest);
    }

    updateForFilter(filter: DataFilter){
        this.sendWorkerMessage({
            command         : WorkerCommands.addRequest,
            filter          : filter,
            event           : Configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED,
            configuration   : this.getConfigurationForWorker()
        } as WorkerRequest);
    }

    onREMEMBER_FILTER(){
        this.sendWorkerMessage({
            command         : WorkerCommands.addFilter,
            value           : this.dataFilter.value,
            mode            : this.dataFilter.mode,
            configuration   : this.getConfigurationForWorker()
        } as WorkerRequest);
    }

    onFORGET_FILTER(GUID: string){
        this.sendWorkerMessage({
            command         : WorkerCommands.removeFilter,
            GUID            : GUID,
            configuration   : this.getConfigurationForWorker()
        } as WorkerRequest);
    }

    onSEARCH_REQUEST_CHANGED(dataFilter: DataFilter){
        this.sendWorkerMessage({
            command         : WorkerCommands.updateActiveFilter,
            event           : Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            eventAfter      : Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH,
            filter          : dataFilter,
            configuration   : this.getConfigurationForWorker()
        } as WorkerRequest);
    }

    onTXT_DATA_COME(data : string){
        this.sendWorkerMessage({
            command : WorkerCommands.create,
            str     : data,
            event   : Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            configuration : this.getConfigurationForWorker()
        } as WorkerRequest);
    }

    onSTREAM_DATA_UPDATE(data: string){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL, (requests:Array<any>)=>{
            this.sendWorkerMessage({
                command : WorkerCommands.add,
                str     : data,
                requests: requests instanceof Array ? requests.map((request) => {
                    return {
                        mode    : request.type,
                        value   : request.value
                    }
                }) : [],
                event   : Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
                configuration : this.getConfigurationForWorker()
            } as WorkerRequest);
        });
    }

    onSEARCH_REQUEST_RESET(){
        this.dataFilter = new DataFilter(MODES.REG, '');
    }

    onVIEW_OUTPUT_IS_CLEARED(){
        this.onTXT_DATA_COME('');
    }

    getConfigurationForWorker(){
        return {
            sets: Configuration.sets
        }
    }

}

let dataController = new DataController();

export { dataController }

