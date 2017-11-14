import { ComponentFactoryResolver           } from '@angular/core';
import { FileLoader                         } from './component';
import { events as Events                   } from '../../../modules/controller.events';
import { configuration as Configuration     } from '../../../modules/controller.config';
import { Handles                            } from './interface';

class FileLoaderController{
    private handles : Handles;

    constructor(){
    }

    open(GUID: symbol, handles : Handles){
        this.handles = handles;
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUEST_FOR_ROOT_HOLDER_RESOLVER, (componentFactoryResolver : ComponentFactoryResolver)=>{
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.ADD_TO_ROOT_HOLDER,
                GUID,
                componentFactoryResolver.resolveComponentFactory(FileLoader),
                { },
                this.onInstance.bind(this)
            );
        });
    }

    onInstance(instance: any){
        instance.open(this.handles);
    }
}

let fileLoaderController = new FileLoaderController();

export { fileLoaderController };