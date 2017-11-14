import { Component, ComponentFactoryResolver, ComponentFactory, ViewChild, ViewContainerRef, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { EventsController                       } from '../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../core/modules/controller.config';

@Component({
    selector        : 'root-holder',
    templateUrl     : './template.html',
})

export class RootHolder implements OnDestroy{

    @ViewChild('placeholder', { read: ViewContainerRef}) placeholder: ViewContainerRef;

    private eventsController : EventsController = new EventsController();

    private refs : Object = {};

    constructor(private componentFactoryResolver : ComponentFactoryResolver){
        this.eventsController.bind(Configuration.sets.SYSTEM_EVENTS.REQUEST_FOR_ROOT_HOLDER_RESOLVER,   this.onREQUEST_FOR_ROOT_HOLDER_RESOLVER.bind(this));
        this.eventsController.bind(Configuration.sets.SYSTEM_EVENTS.ADD_TO_ROOT_HOLDER,                 this.onADD_TO_ROOT_HOLDER.bind(this));
        this.eventsController.bind(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER,            this.onREMOVE_FROM_ROOT_HOLDER.bind(this));
    }

    ngOnDestroy(){
        this.eventsController.kill();
        this.eventsController = null;
    }

    onREQUEST_FOR_ROOT_HOLDER_RESOLVER(callback: Function){
        callback(this.componentFactoryResolver);
    }

    onADD_TO_ROOT_HOLDER(GUID: symbol, factory : ComponentFactory<any>, params: Object, callback: Function){
        let component = this.placeholder.createComponent(factory);
        if (typeof params === 'object' && params !== null){
            Object.keys(params).forEach((key)=>{
                component.instance[key] = params[key];
            });
        }
        if(component.instance.closer !== void 0){
            component.instance.closer.subscribe(()=>{
                component.destroy();
            });
        }
        this.refs[GUID] = component;
        typeof callback === 'function' && callback(component.instance);
    }
    onREMOVE_FROM_ROOT_HOLDER(GUID : symbol){
        if (this.refs[GUID] !== void 0){
            this.refs[GUID].destroy();
        }
    }
}
