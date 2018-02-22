
import { configuration as Configuration } from '../modules/controller.config';
import { events as Events               } from '../../core/modules/controller.events';
import { EventEmitter                   } from "@angular/core";

class ServiceViewsParameters {

    public numbers          : boolean               = true;
    public onNumbersChange  : EventEmitter<boolean> = new EventEmitter();

    constructor(){

    }

    public init(){
        [   Configuration.sets.EVENTS_VIEWS.LIST_VIEW_NUMERIC_TRIGGER
        ].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
    }

    private destroy(){
        [   Configuration.sets.EVENTS_VIEWS.LIST_VIEW_NUMERIC_TRIGGER].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
    }

    private onLIST_VIEW_NUMERIC_TRIGGER(){
        this.numbers = !this.numbers;
        this.onNumbersChange.emit(this.numbers);
    }

}

const viewsParameters = new ServiceViewsParameters();

export { viewsParameters }
