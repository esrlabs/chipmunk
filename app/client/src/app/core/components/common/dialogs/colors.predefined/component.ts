import {Component, Input    } from '@angular/core';

@Component({
    selector    : 'colors-predefined-dialog',
    templateUrl : './template.html',
})

export class ColorsPredefinedDialog {
    @Input() callback       : Function      = null;
    private colors : Array<string> = [
        '#000000',
        '#FFFFFF',
        '#FF0000',
        '#00FF00',
        '#0000FF',
        '#FFFF00',
        '#00FFFF',
        '#C0C0C0',
        '#FF00FF',
        '#808080',
        '#800000',
        '#808000',
        '#008000',
        '#800080',
        '#008080',
        '#000080'
    ];

    constructor() {
    }

    onClick(event : MouseEvent){
        typeof this.callback === 'function' && this.callback(event.target['style'].backgroundColor);
    }

}
