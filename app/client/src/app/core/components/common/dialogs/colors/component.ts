import {Component, Input    } from '@angular/core';

@Component({
    selector    : 'colors-dialog',
    templateUrl : './template.html',
})

export class ColorsDialog {
    @Input() callback       : Function      = null;
    @Input() colors         : Array<string> = [];

    constructor() {
    }

    onClick(event : MouseEvent){
        typeof this.callback === 'function' && this.callback(event.target['style'].backgroundColor);
    }

}
