import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnDestroy, EventEmitter, AfterViewChecked } from '@angular/core';
import {DomSanitizer                            } from '@angular/platform-browser';

import { ViewControllerPattern                  } from '../controller.pattern';
import { Tab                                    } from '../../core/components/common/tabs/interface.tab';

import { Logs, TYPES as LogTypes                } from '../../core/modules/tools.logs';
import { events as Events                       } from '../../core/modules/controller.events';
import { configuration as Configuration         } from '../../core/modules/controller.config';

import { ViewInterface                          } from '../../core/interfaces/interface.view';

import { ViewClass                              } from '../../core/services/class.view';

import { TabControllerSearchResults             } from './tab.results/component';
import { TabControllerSearchRequests            } from './tab.requests/component';


@Component({
    selector        : 'view-controller-search-results',
    templateUrl     : './template.html',
})

export class ViewControllerSearchResults extends ViewControllerPattern implements ViewInterface, OnInit, OnDestroy, AfterViewChecked {

    public viewParams       : ViewClass             = null;

    public tabs             : Array<Tab>            = [];
    private onResize        : EventEmitter<null>    = new EventEmitter();

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef,
        private sanitizer                   : DomSanitizer
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
        let emitterResultsSelect    = new EventEmitter<any>(),
            emitterRequestsSelect   = new EventEmitter<any>(),
            emitterResultsDeselect  = new EventEmitter<any>(),
            emitterRequestsDeselect = new EventEmitter<any>(),
            emitterResultsResize    = new EventEmitter<any>(),
            emitterRequestsResize   = new EventEmitter<any>(),
            emitterSetLabel         = new EventEmitter<any>();
        this.tabs.push({
            id          : Symbol(),
            label       : 'Results',
            onSelect    : emitterResultsSelect,
            onDeselect  : emitterResultsDeselect,
            onResize    : emitterResultsResize,
            setLabel    : emitterSetLabel,
            factory     : this.componentFactoryResolver.resolveComponentFactory(TabControllerSearchResults),
            params      : {
                viewParams  : this.viewParams,
                onSelect    : emitterResultsSelect,
                onDeselect  : emitterResultsDeselect,
                onResize    : emitterResultsResize,
                setLabel    : emitterSetLabel
            },
            update      : null,
            active      : true
        });
        this.tabs.push({
            id          : Symbol(),
            label       : 'Requests',
            onSelect    : emitterRequestsSelect,
            onDeselect  : emitterRequestsDeselect,
            onResize    : emitterResultsResize,
            factory     : this.componentFactoryResolver.resolveComponentFactory(TabControllerSearchRequests),
            params      : {
                viewParams  : this.viewParams,
                onSelect    : emitterRequestsSelect,
                onDeselect  : emitterRequestsDeselect,
                onResize    : emitterResultsResize
            },
            update      : null,
            active      : false
        });
    }

    resizeOnREMOVE_VIEW(){
        this.onResize.emit();
    }
}
