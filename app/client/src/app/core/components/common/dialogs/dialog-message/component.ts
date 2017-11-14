import {Component, Input    } from '@angular/core';
import { Button             } from './handles.intreface';

@Component({
    selector    : 'dialog-message',
    templateUrl : './template.html',
})

export class DialogMessage {
    @Input() message        : string        = '';
    @Input() buttons        : Array<Button> = [];

    constructor() {
    }

}
