import {Component, Input, ChangeDetectorRef         } from '@angular/core';
import { events as Events                           } from '../../../../modules/controller.events';
import { configuration as Configuration             } from '../../../../modules/controller.config';

@Component({
    selector    : 'dialog-statemonitor-indicate-edit',
    templateUrl : './template.html',
})

export class DialogStatemonitorIndicateEdit {
    @Input() name       : string    = '';
    @Input() callback   : Function  = null;

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.onSave         = this.onSave.bind(this);
        this.onLabelChange  = this.onLabelChange.bind(this);
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onLabelChange(event: KeyboardEvent){
        this.name = event.target['value'];
        this.forceUpdate();
    }


    onSave(){
        typeof this.callback === 'function' && this.callback(this.name);
    }

}
