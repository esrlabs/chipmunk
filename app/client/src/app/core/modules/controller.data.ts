import { InitiableModule                        } from '../interfaces/interface.module.initiable';
import { Logs, TYPES as LogTypes                } from './tools.logs';
import { events as Events                       } from './controller.events';
import { configuration as Configuration         } from './controller.config';
import { DataRow                                } from '../interfaces/interface.data.row';
import { DataFilter                             } from '../interfaces/interface.data.filter';
import { MODES                                  } from './controller.data.search.modes';
import { EVENT_DATA_IS_UPDATED                  } from '../interfaces/events/DATA_IS_UPDATE';
import { ClipboardShortcuts, ClipboardKeysEvent } from "./controller.clipboard.shortcuts";
import { Stream                                 } from './controller.data.stream';
class DataController implements InitiableModule{
    private stream      : Stream        = null;
    private dataFilter  : DataFilter    = new DataFilter();
    private requests    : Object        = {};
    private data        : {
        rows    : Array<DataRow>,
    } = {
        rows    : [],
    };
    private clipboardShortcuts  : ClipboardShortcuts = null;

    constructor(){
    }

    private bindEvents(){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,        this.onSEARCH_REQUEST_CHANGED.      bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,                 this.onTXT_DATA_COME.               bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE,            this.onSTREAM_DATA_UPDATE.          bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.REMEMBER_FILTER,               this.onREMEMBER_FILTER.             bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.FORGET_FILTER,                 this.onFORGET_FILTER.               bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_RESET,          this.onSEARCH_REQUEST_RESET.        bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_OUTPUT_IS_CLEARED,        this.onVIEW_OUTPUT_IS_CLEARED.      bind(this));
        Events.bind(Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_INSERT_EMPTY_LINE, this.onSHORTCUT_INSERT_EMPTY_LINE.  bind(this));
        this.clipboardShortcuts.onPaste.subscribe(this.onClipboardPaste.bind(this));
    }

    public init(callback : Function = null){
        Logs.msg('[controller.data] Initialization.', LogTypes.DEBUG);
        this.clipboardShortcuts = new ClipboardShortcuts();
        this.stream = new Stream();
        this.bindEvents();
        typeof callback === 'function' && callback();
        Logs.msg('[controller.data] Finished.', LogTypes.DEBUG);
    }

    public getRows(){
        return this.stream !== null ? this.stream.getRows() : [];
    }

    getRequestGUID(mode: string, value: string){
        let key = mode + value;
        //this.requests[key] === void 0 && (this.requests[key] = GUID.generate());
        this.requests[key] === void 0 && (this.requests[key] = key);
        return this.requests[key];
    }

    updateForParsers(){
        this.stream !== null && this.stream.updateParsers()
            .then((rows: Array<DataRow>) => {
                //TODO: What is here?
            });
    }

    updateForFilter(filter: DataFilter){
        this.stream !== null && this.stream.addRequest(filter)
            .then((rows: Array<DataRow>) => {
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED, rows);
            });
    }

    onREMEMBER_FILTER(){
        this.stream !== null && this.stream.addFilter( { mode : this.dataFilter.mode, value: this.dataFilter.value})
            .then((result: boolean) => {
                //Nothing to do
            });
    }

    onFORGET_FILTER(GUID: string){
        this.stream !== null && this.stream.removeFilter(GUID)
            .then((result: boolean) => {
                //Nothing to do
            });
    }

    onSEARCH_REQUEST_CHANGED(filter: DataFilter){
        if (this.stream !== null) {
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_START, filter);
            this.stream.updateActiveFilter(filter)
                .then((rows: Array<DataRow>) => {
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED, new EVENT_DATA_IS_UPDATED(rows));
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH, filter);
                });
        }
    }

    onTXT_DATA_COME(data : string){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL, (requests: Array<any>)=>{
            requests = requests instanceof Array ? requests.map((request) => {
                return {
                    mode    : request.type,
                    value   : request.value
                }
            }) : [];
            this.stream !== null && this.stream.create(data, requests)
                .then((rows: Array<DataRow>) => {
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED, new EVENT_DATA_IS_UPDATED(rows));
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_BUFFER_IS_UPDATED, this.stream.getBuffer());
                });
        });

    }

    onSTREAM_DATA_UPDATE(data: string, events: Array<string> = []){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL, (requests: Array<any>)=>{
            requests = requests instanceof Array ? requests.map((request) => {
                return {
                    mode    : request.type,
                    value   : request.value
                }
            }) : [];
            this.stream !== null && this.stream.add(data, requests)
                .then((rows: Array<DataRow>) => {
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED, new EVENT_DATA_IS_UPDATED(rows));
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_BUFFER_IS_UPDATED, this.stream.getBuffer());
                    events.forEach((event)=>{
                        Events.trigger(event);
                    });
                });
        });
    }

    onSEARCH_REQUEST_RESET(){
        this.dataFilter = new DataFilter(MODES.REG, '');
    }

    onVIEW_OUTPUT_IS_CLEARED(){
        this.onTXT_DATA_COME('');
    }

    onClipboardPaste(event: ClipboardKeysEvent){
        if (typeof event.text === 'string' && event.text.trim() !== '') {
            this.onTXT_DATA_COME(event.text);
        }
    }

    onSHORTCUT_INSERT_EMPTY_LINE(){
        this.onSTREAM_DATA_UPDATE(' \n', [Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_END]);
    }

    getSnapshot(){
        return {
            filter: this.dataFilter,
            rows: this.stream.getRows(),
            filters: this.stream.getFilters(),
            requests: this.stream.getRequests()
        };
    }

}

let dataController = new DataController();

export { dataController }

