import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnDestroy, EventEmitter, AfterViewChecked } from '@angular/core';
import {DomSanitizer                            } from '@angular/platform-browser';

import { ViewControllerPattern                  } from '../controller.pattern';
import { Tab                                    } from '../../core/components/common/tabs/interface.tab';

import { Logs, TYPES as LogTypes                } from '../../core/modules/tools.logs';
import { events as Events                       } from '../../core/modules/controller.events';
import { configuration as Configuration         } from '../../core/modules/controller.config';

import { ViewInterface                          } from '../../core/interfaces/interface.view';

import { ViewClass                              } from '../../core/services/class.view';

import { ViewControllerTabChart                 } from './tab.chart/component';
import { ViewControllerTabChartManager          } from './tab.manager/component';


@Component({
    selector        : 'view-controller-chart-main',
    templateUrl     : './template.html',
})

export class ViewControllerChart extends ViewControllerPattern implements ViewInterface, OnInit, OnDestroy, AfterViewChecked {

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
        super.getEmitters().resize.subscribe(this.resizeOnREMOVE_VIEW. bind(this));

    }

    ngOnInit(){
        this.viewParams !== null && super.setGUID(this.viewParams.GUID);
        this.initTabs();
    }

    ngOnDestroy(){

    }

    ngAfterViewChecked(){
        super.ngAfterViewChecked();
    }

    initTabs(){
        let emitterChartsSelect     = new EventEmitter<any>(),
            emitterSettingsSelect   = new EventEmitter<any>(),
            emitterChartsDeselect   = new EventEmitter<any>(),
            emitterSettingsDeselect = new EventEmitter<any>(),
            emitterChartsResize     = new EventEmitter<any>(),
            emitterSettingsResize   = new EventEmitter<any>();
        this.tabs.push({
            id          : Symbol(),
            label       : 'Charts',
            onSelect    : emitterChartsSelect,
            onDeselect  : emitterChartsDeselect,
            onResize    : emitterChartsResize,
            factory     : this.componentFactoryResolver.resolveComponentFactory(ViewControllerTabChart),
            params      : {
                viewParams  : this.viewParams,
                onSelect    : emitterChartsSelect,
                onDeselect  : emitterChartsDeselect,
                onResize    : emitterChartsResize
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
            factory     : this.componentFactoryResolver.resolveComponentFactory(ViewControllerTabChartManager),
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
