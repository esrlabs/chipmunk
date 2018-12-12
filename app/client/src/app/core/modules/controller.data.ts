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
import { serviceRequests                        } from "../services/service.requests";
import { popupController                        } from "../../core/components/common/popup/controller";
import { DialogMessage                          } from "../../core/components/common/dialogs/dialog-message/component";

type TFilters       = {[key: string] : DataFilter   };

const REMARKS_INJECTION_MARK = {
    start: '__logviewer_remarks_injection__start__',
    end: '__logviewer_remarks_injection__end__'
};

const CURRENT_REQUESTS_INJECTION_MARK = {
    start: '__logviewer_filters_injection__start__',
    end: '__logviewer_filters_injection__end__'
};

const BOOKMARKS_INJECTION_MARK = {
    start: '__logviewer_bookmarks_injection__start__',
    end: '__logviewer_bookmarks_injection__end__'
};

const REMARKS_INJECTION_EXTRACTOR = /__logviewer_remarks_injection__start__.*__logviewer_remarks_injection__end__/gi;
const REQUEST_INJECTION_EXTRACTOR = /__logviewer_filters_injection__start__.*__logviewer_filters_injection__end__/gi;
const BOOKMARKS_INJECTION_EXTRACTOR = /__logviewer_bookmarks_injection__start__.*__logviewer_bookmarks_injection__end__/gi;

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

    public getCurrentRemarksRecord(remarks: Array<any>): string | null {
        if (!(remarks instanceof Array)) {
            return null;
        }
        let _remarks;
        try {
            _remarks =  btoa(JSON.stringify(remarks));
        } catch (e) {
            return null;
        }
        return `${REMARKS_INJECTION_MARK.start}${_remarks}${REMARKS_INJECTION_MARK.end}`;
    }

    public getCurrentRequestsRecord(): string | null{
        const requests = serviceRequests.convertActiveRequests();
        if (requests === null) {
            return null;
        }
        return `${CURRENT_REQUESTS_INJECTION_MARK.start}${requests}${CURRENT_REQUESTS_INJECTION_MARK.end}`;
    }

    public getBookmarksInjectionRecord(bookmarks: Array<number>): string | null {
        if (!(bookmarks instanceof Array)) {
            return null;
        }
        if (bookmarks.length === 0) {
            return null;
        }
        let _bookmarks;
        try {
            _bookmarks =  btoa(JSON.stringify(bookmarks));
        } catch (e) {
            return null;
        }
        return `${BOOKMARKS_INJECTION_MARK.start}${_bookmarks}${BOOKMARKS_INJECTION_MARK.end}`;
    }

    extractInjectedRemarks(text: string): Array<any> | null {
        if (typeof text !== 'string') {
            return null;
        }
        const match = text.match(REMARKS_INJECTION_EXTRACTOR);
        if (match === null || match.length > 1) {
            return null;
        }
        let remarks: any = match[0].replace(REMARKS_INJECTION_MARK.start, '').replace(REMARKS_INJECTION_MARK.end, '');
        try {
            remarks = JSON.parse(atob(remarks));
        } catch (e) {
            return null;
        }
        return remarks instanceof Array ? remarks : null;
    }

    extractInjectedFilters(text: string): Array<any> | null {
        if (typeof text !== 'string') {
            return null;
        }
        const match = text.match(REQUEST_INJECTION_EXTRACTOR);
        if (match === null || match.length > 1) {
            return null;
        }
        let requests: any = match[0].replace(CURRENT_REQUESTS_INJECTION_MARK.start, '').replace(CURRENT_REQUESTS_INJECTION_MARK.end, '');
        try {
            requests = JSON.parse(atob(requests));
        } catch (e) {
            return null;
        }
        return requests instanceof Array ? requests : null;
    }

    extractInjectedBookmarks(text: string): Array<any> | null {
        if (typeof text !== 'string') {
            return null;
        }
        const match = text.match(BOOKMARKS_INJECTION_EXTRACTOR);
        if (match === null || match.length > 1) {
            return null;
        }
        let bookmarks: any = match[0].replace(BOOKMARKS_INJECTION_MARK.start, '').replace(BOOKMARKS_INJECTION_MARK.end, '');
        try {
            bookmarks = JSON.parse(atob(bookmarks));
        } catch (e) {
            return null;
        }
        return bookmarks instanceof Array ? bookmarks : null;
    }

    clearFromInjections(text: string): string {
        if (typeof text !== 'string') {
            return '';
        }
        return text
            .replace(REMARKS_INJECTION_EXTRACTOR, '')
            .replace(REQUEST_INJECTION_EXTRACTOR, '')
            .replace(BOOKMARKS_INJECTION_EXTRACTOR, '');
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

    updateForFilter(filter: DataFilter): Promise<Array<DataRow>> {
        if (this.stream === null) {
            return Promise.resolve([]);
        }
        return this.stream.addRequest(filter);
        /*
            .then((rows: Array<DataRow>) => {
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED, rows);
            });
            */
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

    onSEARCH_REQUEST_CHANGED(filter: DataFilter, internal: boolean = false){
        if (this.stream !== null) {
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_START, filter);
            this.stream.updateActiveFilter(filter)
                .then((rows: Array<DataRow>) => {
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED, new EVENT_DATA_IS_UPDATED(rows, [], [], filter));
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH, filter);
                });
        }
    }

    onTXT_DATA_COME(data : string) {
        const injectedRemarks = this.extractInjectedRemarks(data);
        const injectedRequests = this.extractInjectedFilters(data);
        const injectedBookmarks = this.extractInjectedBookmarks(data);
        const GUID = Symbol();
        data = this.clearFromInjections(data);
        if (injectedRequests !== null || injectedBookmarks !== null || injectedRemarks !== null) {
            popupController.open({
                content : {
                    factory     : null,
                    component   : DialogMessage,
                    params      : {
                        message : `This file includes injected content (filters, bookmarks, notes). Do you want to activate it? You will not lost your current filters, but it will be deactivated.`,
                        buttons : [
                            {
                                caption: 'Yes, open injected content',
                                handle: () => {
                                    popupController.close(GUID);
                                    //Remove previous temporary requests
                                    serviceRequests.removeAllTemporary(false);
                                    //Add new temporary requests
                                    serviceRequests.addTemporaryRequests(injectedRequests, false);
                                    this.openTextData(data, injectedBookmarks, injectedRemarks);
                                }
                            },
                            {
                                caption: 'No, open just logs',
                                handle: () => {
                                    popupController.close(GUID);
                                    this.openTextData(data, injectedBookmarks);
                                }
                            },
                            {
                                caption: 'Do not open',
                                handle: () => {
                                    popupController.close(GUID);
                                }
                            }
                        ]
                    }
                },
                title   : `Injected filters`,
                settings: {
                    move            : true,
                    resize          : true,
                    width           : '30rem',
                    height          : '12rem',
                    close           : true,
                    addCloseHandle  : false,
                    css             : ''
                },
                buttons         : [],
                titlebuttons    : [],
                GUID            : GUID
            });
        } else {
            this.openTextData(data);
        }
    }

    openTextData(data : string, bookmarks: Array<number> = [], remarks: Array<any> = []){
        if (!~data.search(/(\n|\n\r|\r|\r\n)$/gi)){
            data += '\n';
        }
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL, (requests: Array<any>)=>{
            requests = requests instanceof Array ? requests.map((request) => {
                return {
                    mode    : request.type,
                    value   : request.value
                }
            }) : [];
            this.stream !== null && this.stream.create(data, requests)
                .then((rows: Array<DataRow>) => {
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED, new EVENT_DATA_IS_UPDATED(
                        rows,
                        bookmarks instanceof Array ? bookmarks : [],
                        remarks instanceof Array ? remarks : [],
                        undefined,
                        data
                    ));
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
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED, new EVENT_DATA_IS_UPDATED(rows, undefined, undefined, undefined, data));
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

    public getMatch(filters: TFilters, fragment: string = '') {
        return this.stream.getMatch(filters, fragment);
    }

}

let dataController = new DataController();

export { dataController }

