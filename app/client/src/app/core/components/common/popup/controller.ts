import { ComponentFactoryResolver           } from '@angular/core';
import { Popup                              } from './component';
import { Parameters                         } from './interface';
import { events as Events                   } from '../../../modules/controller.events';
import { configuration as Configuration     } from '../../../modules/controller.config';

class PopupController{
    constructor(){
    }

    open(parameters: Parameters){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUEST_FOR_ROOT_HOLDER_RESOLVER, (componentFactoryResolver : ComponentFactoryResolver)=>{
            //Create factory if it's needed
            if (parameters.content !== void 0 && parameters.content.component !== void 0){
                parameters.content.factory = componentFactoryResolver.resolveComponentFactory(parameters.content.component);
            }
            //Ask controller to render popup
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.ADD_TO_ROOT_HOLDER,
                parameters.GUID,
                componentFactoryResolver.resolveComponentFactory(Popup),
                { parameters : parameters},
                this.onInstance.bind(this)
            );
        });
    }

    close(GUID : any){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
    }

    onInstance(instance: any){

    }
}

let popupController = new PopupController();

export { popupController };