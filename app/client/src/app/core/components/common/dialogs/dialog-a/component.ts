import {Component, Input    } from '@angular/core';
import { Button             } from './handles.intreface';

@Component({
    selector    : 'dialog-a',
    templateUrl : './template.html',
})

export class DialogA {
    @Input() caption        : string        = '';
    @Input() value          : string        = '';
    @Input() type           : string        = 'text';
    @Input() placeholder    : string        = '';
    @Input() buttons        : Array<Button> = [];

    constructor() {
    }

}
