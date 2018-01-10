import {Component, EventEmitter, Input, Output, ViewChild, ViewContainerRef, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { dataController                 } from '../../../core/modules/controller.data';
import { configuration as Configuration } from '../../../core/modules/controller.config';
import { events as Events               } from '../../../core/modules/controller.events';
import { TabController                  } from '../../../core/components/common/tabs/tab/class.tab.controller';
import { Request                        } from './request/interface.request';
import { EVENT_DATA_IS_UPDATED          } from '../../../core/interfaces/events/DATA_IS_UPDATE';
import { Logs, TYPES as LogTypes        } from '../../../core/modules/tools.logs';
import { DataFilter                     } from '../../../core/interfaces/interface.data.filter';
import { localSettings, KEYs            } from '../../../core/modules/controller.localsettings';

const SETTINGS = {
    //FOREGROUND_COLOR    : 'rgb(20,20, 20)',
    //BACKGROUND_COLOR    : 'rgb(255,255,255)',
    FOREGROUND_COLOR    : '',
    BACKGROUND_COLOR    : '',
    LIST_KEY            : 'ListOfRequests'
};

@Component({
    selector    : 'tab-search-requests',
    templateUrl : './template.html',
})

export class TabControllerSearchRequests extends TabController implements OnDestroy, OnInit{
    private requests        : Array<Request>    = [];
    private currentRequest  : Request           = null;

    constructor(
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef
    ) {
        super();
        this.onTabSelected              = this.onTabSelected.   bind(this);
        this.onTabDeselected            = this.onTabDeselected. bind(this);
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
        this.loadRequests();
        this.onRequestsChanges();
    }

    ngOnDestroy(){
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,
            Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_ACCEPTED,
            Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE,
            Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
        this.onSelect.              unsubscribe();
        this.onDeselect.            unsubscribe();
    }

    ngOnInit(){
        this.onSelect   .subscribe(this.onTabSelected);
        this.onDeselect .subscribe(this.onTabDeselected);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Tab functions
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onTabSelected(){
    }

    onTabDeselected(){
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Core events
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onDATA_FILTER_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){

    }

    onSEARCH_REQUEST_CHANGED(event: DataFilter){
        if (event.value !== ''){
            this.currentRequest = this.initRequest({
                GUID            : dataController.getRequestGUID(event.mode, event.value),
                value           : event.value,
                type            : event.mode,
                foregroundColor : SETTINGS.FOREGROUND_COLOR,
                backgroundColor : SETTINGS.BACKGROUND_COLOR,
                active          : true,
                passive         : false,
                count           : 0
            });
        } else {
            this.currentRequest = null;
        }
        this.onRequestsChanges();
    }

    onSEARCH_REQUEST_ACCEPTED(event: DataFilter){
        if (!this.isExist(event.mode, event.value) && event.value !== ''){
            this.requests.push(this.initRequest({
                GUID            : dataController.getRequestGUID(event.mode, event.value),
                value           : event.value,
                type            : event.mode,
                foregroundColor : SETTINGS.FOREGROUND_COLOR,
                backgroundColor : SETTINGS.BACKGROUND_COLOR,
                active          : true,
                passive         : false,
                count           : 0
            }));
            this.onRequestsChanges();
        }
    }

    onREQUESTS_HISTORY_GET_ALL(callback: Function){
        typeof callback === 'function' && callback(this.getActiveRequests());
    }

    onDATA_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
            let measure = Logs.measure('[view.search.results.requests][onDATA_IS_UPDATED]');
            this.updateSearchResults();
            Logs.measure(measure);
        }
    }

    onDATA_IS_MODIFIED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
            //Magic happens on [controller.data.ts]
        }
    }

    onREQUESTS_HISTORY_UPDATED_OUTSIDE(requests: Array<Request>){
        this.requests = requests.map((request: Request)=>{
            return this.initRequest(request);
        });
        this.onRequestsChanges();
        this.forceUpdate();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Requests stuff
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    updateSearchResults(current: boolean = false){
        if (!current) {
            let measure = Logs.measure('[view.search.results.requests][updateSearchResults]');
            this.requests.forEach((request: Request)=>{
                request.active && dataController.updateForFilter({
                    mode    : request.type,
                    value   : request.value
                });
            });
            Logs.measure(measure);
        }
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_APPLIED, dataController.getRows());
    }

    isExist(mode: string, value: string){
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
    initRequest(request : Request){
        return {
            GUID            : dataController.getRequestGUID(request.type, request.value),
            value           : request.value,
            backgroundColor : request.backgroundColor,
            foregroundColor : request.foregroundColor,
            active          : request.active,
            type            : request.type,
            passive         : request.passive,
            count           : request.count !== void 0 ? request.count : 0,
            onChangeColor   : this.onRequestColorChange. bind(this, request.value),
            onRemove        : this.onRequestRemove.      bind(this, request.value),
            onChangeState   : this.onRequestChangeState. bind(this, request.value),
            onChange        : this.onRequestChange.      bind(this, request.value)
        }
    }

    onRequestColorChange(hook: string, foregroundColor: string, backgroundColor: string){
        let index = this.getRequestIndexByHook(hook);
        if (~index){
            this.requests[index].backgroundColor = backgroundColor;
            this.requests[index].foregroundColor = foregroundColor;
            this.onRequestsChanges();
            this.forceUpdate();
        }
    }

    onRequestRemove(hook: string){
        let index = this.getRequestIndexByHook(hook);
        if (~index){
            this.requests.splice(index, 1);
            this.onRequestsChanges();
            this.forceUpdate();
        }
    }

    onRequestChangeState(hook: string, state: boolean){
        let index = this.getRequestIndexByHook(hook);
        if (~index){
            this.requests[index].active = state;
            this.onRequestsChanges();
            this.forceUpdate();
        }
    }

    onRequestChange(hook: string, updated: string, foregroundColor: string, backgroundColor: string, type: string, passive: boolean){
        let index = this.getRequestIndexByHook(hook);
        if (~index){
            if (!~this.getRequestIndexByHook(updated)){
                this.requests[index] = this.initRequest({
                    GUID            : dataController.getRequestGUID(type, updated),
                    value           : updated,
                    type            : type,
                    foregroundColor : foregroundColor,
                    backgroundColor : backgroundColor,
                    active          : this.requests[index].active,
                    passive         : passive,
                    count           : this.requests[index].count !== void 0 ? this.requests[index].count : 0
                });
            } else {
                let index = this.getRequestIndexByHook(updated);
                this.requests[index].foregroundColor    = foregroundColor;
                this.requests[index].backgroundColor    = backgroundColor;
                this.requests[index].type               = type;
                this.requests[index].passive            = passive;
            }
            this.onRequestsChanges();
            this.forceUpdate();
        }
    }

    getRequestIndexByHook(hook: string){
        let result = -1;
        this.requests.forEach((request, index)=>{
            request.value === hook && (result = index);
        });
        return result;
    }

    getActiveRequests(){
        return this.requests
            .filter((request)=>{
                return request.active;
            })
            .map((request)=>{
                return {
                    GUID            : dataController.getRequestGUID(request.type, request.value),
                    value           : request.value,
                    passive         : request.passive,
                    type            : request.type,
                    foregroundColor : request.foregroundColor,
                    backgroundColor : request.backgroundColor,
                }
            });
    }

    getCurrentRequest(){
        return this.currentRequest !== null ? [{
            GUID            : dataController.getRequestGUID(this.currentRequest.type, this.currentRequest.value),
            value           : this.currentRequest.value,
            passive         : this.currentRequest.passive,
            type            : this.currentRequest.type,
            foregroundColor : this.currentRequest.foregroundColor,
            backgroundColor : this.currentRequest.backgroundColor,
        }] : [];
    }

    getRequests(){
        return this.requests.map((request)=>{
                return {
                    GUID            : dataController.getRequestGUID(request.type, request.value),
                    value           : request.value,
                    passive         : request.passive,
                    type            : request.type,
                    foregroundColor : request.foregroundColor,
                    backgroundColor : request.backgroundColor,
                    active          : request.active,
                    count           : request.count !== void 0 ? request.count : 0
                }
            });
    }

    onRequestsChanges(){
        this.saveRequests();
        if (this.getActiveRequests().length === 0) {
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED, this.getCurrentRequest(), this.getRequests());
            this.updateSearchResults(true);
        } else {
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED, this.getActiveRequests(), this.getRequests());
            this.updateSearchResults();
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Service stuff
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    getSerializedRequests(){
        return this.requests.map((request)=>{
            return {
                value           : request.value,
                type            : request.type,
                backgroundColor : request.backgroundColor,
                foregroundColor : request.foregroundColor,
                passive         : request.passive,
                active          : request.active
            };
        });
    }

    loadRequests(){
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.view_searchrequests] !== void 0 && settings[KEYs.view_searchrequests] !== null && settings[KEYs.view_searchrequests][SETTINGS.LIST_KEY] instanceof Array){
            this.requests = settings[KEYs.view_searchrequests][SETTINGS.LIST_KEY].map((request : any)=>{
                return this.initRequest(request);
            });
        }
    }

    saveRequests(){
        localSettings.set({
            [KEYs.view_searchrequests] : {
                [SETTINGS.LIST_KEY] : this.getSerializedRequests()
            }
        });
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

}
