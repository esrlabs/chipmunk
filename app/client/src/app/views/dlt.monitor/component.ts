import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, EventEmitter, OnDestroy } from '@angular/core';

import { ViewControllerPattern                  } from '../controller.pattern';
import { ViewInterface                          } from '../../core/interfaces/interface.view';
import { ViewClass                              } from '../../core/services/class.view';

import { events as Events                       } from '../../core/modules/controller.events';
import { configuration as Configuration         } from '../../core/modules/controller.config';

import * as IDlt from '../../core/modules/dlt/dlt.interface';
import DLTService from '../../core/modules/dlt/service.dlt';


@Component({
    selector        : 'view-controller-dlt-monitor',
    templateUrl     : './template.html'
})

export class ViewControllerDLTMonitor extends ViewControllerPattern implements ViewInterface, OnInit, OnDestroy {

    public viewParams: ViewClass = null;
    private _structure: IDlt.TStructure | null = null;
    private _isOpened: { [key: string]: boolean } = {};

    ngOnInit(){
        this.viewParams !== null && super.setGUID(this.viewParams.GUID);
    }

    ngOnDestroy(){
        DLTService.unsubscribe(DLTService.EVENTS.structure, this._onStructure);
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    constructor(
        private changeDetectorRef: ChangeDetectorRef
    ){
        super();
        this.changeDetectorRef = changeDetectorRef;
        this._onStructure = this._onStructure.bind(this);
        this._structure = DLTService.getStructure();
        DLTService.subscribe(DLTService.EVENTS.structure, this._onStructure);
    }

    private _onStructure(structure: IDlt.TStructure) {
        this._structure = structure;
    }

    private _getCount(edu: string, app: string = '', cntx: string = '') {
        return DLTService.getCount(edu, app, cntx);
    }

    private _onEntryClick(event: MouseEvent, id: string) {
        if (id !== null) {
            if (this._isOpened[id] === void 0) {
                this._isOpened[id] = true;
            } else {
                delete this._isOpened[id];
            }
        }
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

}
