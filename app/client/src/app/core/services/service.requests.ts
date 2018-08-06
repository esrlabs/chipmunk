import { configuration as Configuration } from '../modules/controller.config';
import { events as Events               } from '../modules/controller.events';
import { Request, Preset                } from './interface.request';
import { EVENT_DATA_IS_UPDATED          } from '../interfaces/events/DATA_IS_UPDATE';
import { Logs, TYPES as LogTypes        } from '../modules/tools.logs';
import { DataFilter                     } from '../interfaces/interface.data.filter';
import { localSettings, KEYs            } from '../modules/controller.localsettings';
import { DataRow                        } from "../interfaces/interface.data.row";

const SETTINGS = {
    FOREGROUND_COLOR    : '',
    BACKGROUND_COLOR    : '',
    LIST_KEY            : 'ListOfRequests',
    PRESETS             : 'SearchPresets'
};

class PresetsManager {

    private presets: Array<Preset> = [];

    constructor(){
        this.loadPresets();
    }

    private loadPresets(){
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.view_searchrequests] !== void 0 && settings[KEYs.view_searchrequests] !== null && settings[KEYs.view_searchrequests][SETTINGS.PRESETS] instanceof Array){
            this.presets = settings[KEYs.view_searchrequests][SETTINGS.PRESETS].filter((request : any)=>{ return true; });
        }
    }

    private savePresets(){
        localSettings.set({
            [KEYs.view_searchrequests] : {
                [SETTINGS.PRESETS] : this.presets
            }
        });
    }

    private serializePresets(presets: Array<Preset>){
        return presets instanceof Array ? presets.map((preset: Preset) =>{
            return {
                name: preset.name,
                requests: preset.requests instanceof Array ? preset.requests.map((request: Request) => {
                    return Object.assign({}, request)
                }) : []
            }
        }) : [];
    }

    public getPresets(){
        return this.serializePresets(this.presets);
    }

    public setPresets(presets: Array<Preset>){
        this.presets = this.serializePresets(presets);
        this.savePresets();
    }
}

class ServiceRequests {

    private requests        : Array<Request>    = [];
    private currentRequest  : Request           = null;
    private dataController  : any               = null;
    private presetManager   : PresetsManager    = new PresetsManager();

    constructor( ) {

    }

    destroy(){
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,
            Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_ACCEPTED,
            Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE,
            Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
    }

    init(){
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,
            Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_ACCEPTED,
            Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE,
            Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        this.dataController = require('../modules/controller.data').dataController;
        this.loadRequests();
        this.onRequestsChanges();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Core events
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private onDATA_FILTER_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
        if (event.filter.value === '') {
            return;
        }
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED, event.rows);
    }

    private onSEARCH_REQUEST_CHANGED(event: DataFilter, internal: boolean = false){
        if (event.value !== ''){
            this.currentRequest = this.initRequest({
                GUID            : this.dataController.getRequestGUID(event.mode, event.value),
                value           : event.value,
                type            : event.mode,
                foregroundColor : SETTINGS.FOREGROUND_COLOR,
                backgroundColor : SETTINGS.BACKGROUND_COLOR,
                active          : true,
                passive         : false,
                count           : 0,
                visibility      : true,
                isTemporary     : false
            });
        } else {
            this.currentRequest = null;
        }
        !internal && this.onRequestsChanges();
    }

    private onSEARCH_REQUEST_ACCEPTED(event: DataFilter, dropCurrent: boolean = false){
        if (!this.isExist(event.mode, event.value) && event.value !== ''){
            this.requests.push(this.initRequest({
                GUID            : this.dataController.getRequestGUID(event.mode, event.value),
                value           : event.value,
                type            : event.mode,
                foregroundColor : SETTINGS.FOREGROUND_COLOR,
                backgroundColor : SETTINGS.BACKGROUND_COLOR,
                active          : true,
                passive         : false,
                count           : 0,
                visibility      : true,
                isTemporary     : false

            }));
            if (dropCurrent) {
                this.currentRequest = null;
            }
            this.onRequestsChanges();
        }
    }

    private onREQUESTS_HISTORY_GET_ALL(callback: Function){
        typeof callback === 'function' && callback(this.getActiveRequests());
    }

    private onDATA_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
            let measure = Logs.measure('[view.search.results.requests][onDATA_IS_UPDATED]');
            this.updateSearchResults();
            Logs.measure(measure);
        }
    }

    private onDATA_IS_MODIFIED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
            //Magic happens on [controller.data.ts]
        }
    }

    private onREQUESTS_HISTORY_UPDATED_OUTSIDE(requests: Array<Request>){
        this.updateRequests(requests);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Group manipulations
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    public deactivateAllCurrentRequests(silence: boolean = true){
        this.setToAllCurrentRequests({ active: false}, silence);
    }

    public activateAllCurrentRequests(silence: boolean = true){
        this.setToAllCurrentRequests({ active: true}, silence);
    }

    public hideAllCurrentRequests(silence: boolean = true){
        this.setToAllCurrentRequests({ visibility: false}, silence);
    }

    public showAllCurrentRequests(silence: boolean = true){
        this.setToAllCurrentRequests({ visibility: true}, silence);
    }

    public setToAllCurrentRequests(params: any, silence: boolean = true){
        this.requests = this.requests.map((request: Request) =>{
            if (request.isTemporary === void 0 || !request.isTemporary){
                Object.keys(params).forEach((key: string) => {
                    request[key] = params[key];
                });
            }
            return request;
        });
        if (silence){
            this.saveRequests();
        } else {
            this.onRequestsChanges();
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Temporary requests
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    public addTemporaryRequests(requests: Array<Request>, silence: boolean = true){
        if (!(requests instanceof Array) || requests.length === 0) {
            return;
        }
        requests = requests.map((request: Request) => {
           request.isTemporary = true;
           request.active = true;
           request.visibility = true;
           return request;
        });
        this.requests.push(...requests);
        this.deactivateAllCurrentRequests();
        if (silence){
            this.saveRequests();
        } else {
            this.onRequestsChanges();
        }
    }

    public removeAllTemporary(silence: boolean = true){
        this.requests = this.requests.filter((request: Request) =>{
            return request.isTemporary === void 0 ? true : !request.isTemporary;
        });
        if (silence){
            this.saveRequests();
        } else {
            this.onRequestsChanges();
        }
    }

    public hasTemporaryRequests(): boolean{
        let result = false;
        this.requests.forEach((request: Request) => {
           if (request.isTemporary) {
               result = true;
           }
        });
        return result;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Requests stuff
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private updateSearchResults(){
        const measure   = Logs.measure('[view.search.results.requests][updateSearchResults]');
        const active    = this.getActiveRequests();
        if (active.length > 0) {
            Promise.all(active.map((request: Request)=>{
                return this.dataController.updateForFilter({
                    mode    : request.type,
                    value   : request.value
                });
            }))
                .then((results: Array<Array<DataRow>>) => {
                    Events.trigger(
                        Configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED,
                        results.length > 0 ? results[results.length - 1] : []
                    );
                });
        } else {
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED, this.dataController.getRows());
        }
        Logs.measure(measure);
    }

    private isExist(mode: string, value: string){
        let result = false;
        this.requests.forEach((request: Request)=>{
            if (request.type === mode && request.value === value){
                result = true;
            }
        });
        return result;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Service stuff
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private initRequest(request : Request){
        return {
            GUID            : this.dataController.getRequestGUID(request.type, request.value),
            value           : request.value,
            backgroundColor : request.backgroundColor,
            foregroundColor : request.foregroundColor,
            active          : request.active,
            type            : request.type,
            passive         : request.passive,
            count           : request.count !== void 0 ? request.count : 0,
            visibility      : request.visibility !== void 0 ? request.visibility : true,
            isTemporary     : request.isTemporary !== void 0 ? request.isTemporary : false
        }
    }

    private getRequestIndexByHook(hook: string){
        let result = -1;
        this.requests.forEach((request, index)=>{
            request.value === hook && (result = index);
        });
        return result;
    }

    public updateRequests(requests: Array<Request>, silince: boolean = false){
        this.requests = requests.map((request: Request)=>{
            return this.initRequest(request);
        });
        if (silince){
            this.saveRequests();
        } else {
            this.onRequestsChanges();
        }
    }

    public getActiveRequests(): Array<Request> {
        return this.requests
            .filter((request)=>{
                return request.active;
            })
            .map((request)=>{
                return {
                    GUID            : this.dataController.getRequestGUID(request.type, request.value),
                    value           : request.value,
                    passive         : request.passive,
                    type            : request.type,
                    foregroundColor : request.foregroundColor,
                    backgroundColor : request.backgroundColor,
                    visibility      : request.visibility !== void 0 ? request.visibility : true,
                    isTemporary     : request.isTemporary !== void 0 ? request.isTemporary : false,
                } as Request
            });
    }

    public getVisibleActiveRequests(): Array<Request> {
        return this.requests
            .filter((request)=>{
                return request.active ? request.visibility : false;
            })
            .map((request)=>{
                return {
                    GUID            : this.dataController.getRequestGUID(request.type, request.value),
                    value           : request.value,
                    passive         : request.passive,
                    type            : request.type,
                    foregroundColor : request.foregroundColor,
                    backgroundColor : request.backgroundColor,
                    visibility      : request.visibility !== void 0 ? request.visibility : true,
                    isTemporary     : request.isTemporary !== void 0 ? request.isTemporary : false,
                } as Request
            });
    }

    public getCurrentRequest(): Array<Request>{
        return this.currentRequest !== null ? [{
            GUID            : this.dataController.getRequestGUID(this.currentRequest.type, this.currentRequest.value),
            value           : this.currentRequest.value,
            passive         : this.currentRequest.passive,
            type            : this.currentRequest.type,
            foregroundColor : this.currentRequest.foregroundColor,
            backgroundColor : this.currentRequest.backgroundColor,
            visibility      : this.currentRequest.visibility !== void 0 ? this.currentRequest.visibility : true,
            isTemporary     : this.currentRequest.isTemporary !== void 0 ? this.currentRequest.isTemporary : false,
        } as Request] : [];
    }

    public getRequests(): Array<Request> {
        return this.requests.map((request)=>{
            return {
                GUID            : this.dataController.getRequestGUID(request.type, request.value),
                value           : request.value,
                passive         : request.passive,
                type            : request.type,
                foregroundColor : request.foregroundColor,
                backgroundColor : request.backgroundColor,
                active          : request.active,
                count           : request.count !== void 0 ? request.count : 0,
                visibility      : request.visibility !== void 0 ? request.visibility : true,
                isTemporary     : request.isTemporary !== void 0 ? request.isTemporary : false
            }
        });
    }

    public convertActiveRequests(): string | null {
        let requests = this.getActiveRequests();
        if (requests.length === 0) {
            return null;
        }
        try {
            return btoa(JSON.stringify(requests));
        } catch (e) {
            return null;
        }
    }

    private onRequestsChanges(){
        if (this.getCurrentRequest().length !== 0){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED, this.getCurrentRequest(), this.getRequests());
        } else {
            this.saveRequests();
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED, this.getActiveRequests(), this.getRequests());
            this.updateSearchResults();
        }

    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Presets manager
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    public getPresets(){
        return this.presetManager.getPresets();
    }

    public setPresets(presets: Array<Preset>){
        this.presetManager.setPresets(presets);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Service stuff
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private getSerializedRequests(){
        return this.requests.filter((request: Request) => {
            return request.isTemporary === void 0 ? true : (request.isTemporary ? false : true);
        }).map((request)=>{
            return {
                value           : request.value,
                type            : request.type,
                backgroundColor : request.backgroundColor,
                foregroundColor : request.foregroundColor,
                passive         : request.passive,
                active          : request.active,
                visibility      : request.visibility !== void 0 ? request.visibility : true
            };
        });
    }

    private loadRequests(){
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.view_searchrequests] !== void 0 && settings[KEYs.view_searchrequests] !== null && settings[KEYs.view_searchrequests][SETTINGS.LIST_KEY] instanceof Array){
            this.requests = settings[KEYs.view_searchrequests][SETTINGS.LIST_KEY].map((request : any)=>{
                return this.initRequest(request);
            });
        }
    }

    private saveRequests(){
        localSettings.set({
            [KEYs.view_searchrequests] : {
                [SETTINGS.LIST_KEY] : this.getSerializedRequests()
            }
        });
    }
}

export const serviceRequests = new ServiceRequests();