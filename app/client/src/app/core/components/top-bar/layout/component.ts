import { Component, OnDestroy                   } from '@angular/core';
import { events as Events                       } from '../../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../../core/modules/controller.config';

@Component({
    selector    : 'top-bar',
    templateUrl : './template.html',
})

export class TopBar implements OnDestroy{

    private desktop: boolean = false;

    constructor( ){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.DESKTOP_MODE_NOTIFICATION, this.onDESKTOP_MODE_NOTIFICATION.bind(this));
    }

    ngOnDestroy(){
    }

    onDESKTOP_MODE_NOTIFICATION(){
        this.desktop = true;
    }

}
