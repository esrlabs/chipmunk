import {Component, Input, ChangeDetectorRef         } from '@angular/core';
import { events as Events                           } from '../../../../modules/controller.events';
import { configuration as Configuration             } from '../../../../modules/controller.config';

@Component({
    selector    : 'dialog-statemonitor-editjson',
    templateUrl : './template.html',
})

export class DialogStatemonitorEditJSON {
    @Input() json       : string    = '';
    @Input() callback   : Function  = null;
    public error : boolean = false;

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.onSave = this.onSave.bind(this);
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onKeyPress(event: KeyboardEvent){

    }

    onFocus(){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON);
    }

    onBlur(){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF);
    }

    onKeyUp(event: KeyboardEvent){
        this.error = false;
        this.forceUpdate();
    }

    onKeyDown(event: KeyboardEvent){

    }

    onSave(){
        try{
            let result = JSON.parse(this.json);
        } catch (e){
            this.error = true;
            this.forceUpdate();
        }
        if (!this.error){
            typeof this.callback === 'function' && this.callback(this.json);
        }
    }

}
