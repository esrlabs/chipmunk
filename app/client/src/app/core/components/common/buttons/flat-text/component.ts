import {Component, Input    } from '@angular/core';

@Component({
    selector    : 'button-flat-text',
    templateUrl : './template.html',
})

export class ButtonFlatText {
    @Input() caption        : string        = '';
    @Input() handle         : Function      = function() {};

    constructor() {
    }

}
