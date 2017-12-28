import {Component, Input, Output} from '@angular/core';

@Component({
    selector    : 'button-flat-text',
    templateUrl : './template.html',
})

export class ButtonFlatText {
    @Input() caption        : string        = '';
    @Input() handle         : Function      = function() {};
    @Input() enabled        : boolean       = true;

    @Output() disable(){
        return this.enabled = false;
    }

    @Output() enable(){
        return this.enabled = true;
    }

    constructor() {
    }

}
