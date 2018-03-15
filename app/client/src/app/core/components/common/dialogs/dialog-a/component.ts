import {Component, Input, ViewChild    } from '@angular/core';
import { Button             } from './handles.intreface';
import {CommonInput} from "../../input/component";

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

    @ViewChild('input' ) input : CommonInput;

    constructor() {
        this.onButtonClick = this.onButtonClick.bind(this);
    }

    onButtonClick(handle: Function){
        typeof handle === 'function' && handle(this.input.getValue());
    }

}
