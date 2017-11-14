import {Component, Input    } from '@angular/core';

@Component({
    selector    : 'dialog-serialports-list',
    templateUrl : './template.html',
})

export class DialogSerialPortsList {
    @Input() ports      : Array<string> = [];
    @Input() handler    : Function      = null;

    constructor() {
    }

    onSelect(portID: string, settings: boolean){
        typeof this.handler === 'function' && this.handler(portID, settings);
    }

}
