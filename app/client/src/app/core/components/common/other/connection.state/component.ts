import {Component, OnDestroy, ChangeDetectorRef, Input  } from '@angular/core';
import { events as Events                               } from '../../../../modules/controller.events';
import { configuration as Configuration                 } from '../../../../modules/controller.config';

@Component({
    selector    : 'connection-state',
    templateUrl : './template.html',
})
export class ConnectionState implements OnDestroy {
    @Input() label : boolean = true;

    public connected : boolean = false;

    constructor(private changeDetectorRef   : ChangeDetectorRef) {
        this.onWS_STATE_CHANGED = this.onWS_STATE_CHANGED.bind(this);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.WS_STATE_CHANGED, this.onWS_STATE_CHANGED);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.WS_STATE_GET, (connected: boolean)=>{
            this.connected = connected;
            //this.forceUpdate();
        });
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    ngOnDestroy(){
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.WS_STATE_CHANGED, this.onWS_STATE_CHANGED);
    }

    onWS_STATE_CHANGED(connected: boolean){
        this.connected = connected;
        this.forceUpdate();
    }

}
