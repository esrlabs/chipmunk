import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, EventEmitter, OnDestroy, Input, AfterContentChecked } from '@angular/core';

import { Logs, TYPES as LogTypes                } from '../../../core/modules/tools.logs';
import { events as Events                       } from '../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../core/modules/controller.config';

import { ViewInterface                          } from '../../../core/interfaces/interface.view';
import { DataRow                                } from '../../../core/interfaces/interface.data.row';
import { EVENT_DATA_IS_UPDATED                  } from '../../../core/interfaces/events/DATA_IS_UPDATE';

import { ViewClass                              } from '../../../core/services/class.view';

import { Indicate                               } from './item/interface';

import { localSettings, KEYs                    } from '../../../core/modules/controller.localsettings';

import { TabController                          } from '../../../core/components/common/tabs/tab/class.tab.controller';

const SETTINGS = {
    LIST_KEY    : 'LIST_KEY'
};


@Component({
    selector        : 'view-controller-state-monitor',
    templateUrl     : './template.html'
})

export class ViewControllerStateMonitor extends TabController implements ViewInterface, OnInit, OnDestroy, AfterContentChecked {

    @Input() viewParams : ViewClass         = null;

    public indicates    : Array<Indicate>   = [];

    private _indicates  : Array<Indicate>   = [];

    ngOnInit(){
        this.onSelect.subscribe(this.onSelectTab);
        this.onDeselect.subscribe(this.onDeselectTab);
        //this.emulate();
    }

    ngOnDestroy(){
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
        this.onSelect.              unsubscribe();
        this.onDeselect.            unsubscribe();
    }

    ngAfterContentChecked(){
    }

    onSelectTab(){
        this.loadIndicates();
        this.initIndicates();
    }

    onDeselectTab(){

    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef
    ){
        super();
        this.componentFactoryResolver   = componentFactoryResolver;
        this.viewContainerRef           = viewContainerRef;
        this.changeDetectorRef          = changeDetectorRef;

        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        this.onSelectTab   = this.onSelectTab.bind(this);
        this.onDeselectTab = this.onDeselectTab.bind(this);
        this.loadIndicates();
        this.initIndicates();
    }

    initIndicates(){
        this.indicates = Object.keys(this._indicates).map((id)=>{
            let indicate            = Object.assign({}, this._indicates[id]);
            indicate.updateState    = new EventEmitter();
            return indicate;
        });
    }

    checkIndicatesByStr(str: string){
        this.indicates.forEach((indicate)=>{
            indicate.updateState.emit(str);
        });
    }

    checkIncomeDate(rows : Array<DataRow>){
        if (rows instanceof Array && rows.length > 0 && this.indicates instanceof Array && this.indicates.length > 0){
            rows.forEach((row)=>{
                this.checkIndicatesByStr(row.str);
            });
        }
    }


    onDATA_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
        let measure = Logs.measure('[view.statemonitor][onDATA_IS_UPDATED]');
        this.checkIncomeDate(event.rows);
        Logs.measure(measure);
    }

    onDATA_FILTER_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
        }
    }

    onDATA_IS_MODIFIED(event : EVENT_DATA_IS_UPDATED){
        let measure = Logs.measure('[view.statemonitor][onDATA_IS_MODIFIED]');
        this.checkIncomeDate(event.rows);
        Logs.measure(measure);
    }

    onROW_IS_SELECTED(index : number){
    }

    emulate(){
        let lines = [
            'CONTROL CENTER LOCK succeeded, vehicle unlocked',
            'CONTROL CENTER LOCK succeeded, vehicle locked',
            'CONTROL CENTER LOCK succeeded, vehicle secured',
            'DRIVER_DOOR_OPENED even',
            'DRIVER_DOOR_CLOSED event',
            'PASSENGER_DOOR_OPENED event',
            'PASSENGER_DOOR_CLOSED event',
            'ACTIVATE IMMOBILIZER succeeded',
            'DEACTIVATE IMMOBILIZER succeeded',
            'ENGINE_STARTED event',
            'ENGINE_STOPPED event',
            'CSM4 Team proudly presents:'
        ],
        index = Math.ceil(lines.length * Math.random());
        this.checkIndicatesByStr(lines[index <= lines.length - 1 ? index : index - 1]);
        setTimeout(this.emulate.bind(this), 500 * Math.random());
    }

    loadIndicates(){
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.view_statemonitor] !== void 0
            && settings[KEYs.view_statemonitor] !== null
            && typeof settings[KEYs.view_statemonitor][SETTINGS.LIST_KEY] === 'object'
            && settings[KEYs.view_statemonitor][SETTINGS.LIST_KEY] !== null){
            this._indicates = Object.keys(settings[KEYs.view_statemonitor][SETTINGS.LIST_KEY]).map((id)=>{
                return Object.assign({}, settings[KEYs.view_statemonitor][SETTINGS.LIST_KEY][id]);
            });
        } else {
            this._indicates = Object.keys(Configuration.sets.VIEW_STATEMONITOR.IndicatesRules).map((id)=>{
                return Object.assign({}, Configuration.sets.VIEW_STATEMONITOR.IndicatesRules[id]);
            });
        }
    }

    saveIndicates(){
        localSettings.set({
            [KEYs.view_statemonitor] : {
                [SETTINGS.LIST_KEY] : this._indicates
            }
        });
    }


}
