import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnDestroy, EventEmitter, AfterViewChecked } from '@angular/core';

import { ViewControllerPattern                  } from '../controller.pattern';
import { Tab                                    } from '../../core/components/common/tabs/interface.tab';

import { Logs, TYPES as LogTypes                } from '../../core/modules/tools.logs';
import { events as Events                       } from '../../core/modules/controller.events';
import { configuration as Configuration         } from '../../core/modules/controller.config';

import { ViewInterface                          } from '../../core/interfaces/interface.view';

import { ViewClass                              } from '../../core/services/class.view';

import { ViewControllerStateMonitor             } from './statemonitor.monitor/component';
import { ViewControllerStateMonitorManager      } from './statemonitor.manager/component';


@Component({
    selector        : 'view-controller-state-monitor-main',
    templateUrl     : './template.html'
})

export class ViewControllerStateMonitorMain extends ViewControllerPattern implements ViewInterface, OnInit, OnDestroy {
    public viewParams       : ViewClass             = null;

    public tabs             : Array<Tab>            = [];
    private onResize        : EventEmitter<null>    = new EventEmitter();

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef
    ){
        super();
        this.componentFactoryResolver   = componentFactoryResolver;
        this.viewContainerRef           = viewContainerRef;
        this.changeDetectorRef          = changeDetectorRef;


        [   /*Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED*/].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        super.getEmitters().resize.subscribe(this.resizeOnREMOVE_VIEW. bind(this));

    }

    ngOnInit(){
        this.viewParams !== null && super.setGUID(this.viewParams.GUID);
        this.initTabs();
    }

    ngOnDestroy(){
        [   /*Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED*/].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
    }

    ngAfterViewChecked(){
        super.ngAfterViewChecked();
    }

    initTabs(){
        let emitterMonitorSelect        = new EventEmitter<any>(),
            emitterSettingsSelect       = new EventEmitter<any>(),
            emitterMonitorDeselect      = new EventEmitter<any>(),
            emitterSettingsDeselect     = new EventEmitter<any>(),
            emitterMonitorResize        = new EventEmitter<any>(),
            emitterSettingsResize       = new EventEmitter<any>();
        this.tabs.push({
            id          : Symbol(),
            label       : 'Monitor',
            onSelect    : emitterMonitorSelect,
            onDeselect  : emitterMonitorDeselect,
            onResize    : emitterMonitorResize,
            factory     : this.componentFactoryResolver.resolveComponentFactory(ViewControllerStateMonitor),
            params      : {
                viewParams  : this.viewParams,
                onSelect    : emitterMonitorSelect,
                onDeselect  : emitterMonitorDeselect,
                onResize    : emitterMonitorResize
            },
            update      : null,
            active      : true
        });
        this.tabs.push({
            id          : Symbol(),
            label       : 'Manager',
            onSelect    : emitterSettingsSelect,
            onDeselect  : emitterSettingsDeselect,
            onResize    : emitterSettingsResize,
            factory     : this.componentFactoryResolver.resolveComponentFactory(ViewControllerStateMonitorManager),
            params      : {
                viewParams  : this.viewParams,
                onSelect    : emitterSettingsSelect,
                onDeselect  : emitterSettingsDeselect,
                onResize    : emitterSettingsResize
            },
            update      : null,
            active      : false
        });
    }

    resizeOnREMOVE_VIEW(){
        this.onResize.emit();
    }
}
