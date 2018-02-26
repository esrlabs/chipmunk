import {Component, Input    } from '@angular/core';

const DEFAULTS_COLORS = [
    '#000000',
    '#FFFFFF',
    '#55efc4',
    '#81ecec',
    '#74b9ff',
    '#a29bfe',
    '#dfe6e9',
    '#00b894',
    '#00cec9',
    '#dfe6e9',
    '#b2bec3',
    '#ffeaa7',
    '#fab1a0',
    '#ff7675',
    '#fd79a8',
    '#636e72',
    '#fdcb6e',
    '#e17055',
    '#d63031',
    '#2d3436',
    '#f3a683',
    '#f7d794',
    '#778beb',
    '#e77f67',
    '#cf6a87',
    '#f19066',
    '#e15f41',
    '#786fa6',
    '#f8a5c2',
    '#63cdda',
    '#ea8685',
    '#596275',
    '#574b90',
    '#f78fb3',
    '#3dc1d3',
    '#e66767',
    '#303952',
    '#badc58',
    '#6ab04c'
];

@Component({
    selector    : 'colors-predefined-dialog',
    templateUrl : './template.html',
})

export class ColorsPredefinedDialog {
    @Input() callback   : Function      = null;

    @Input() colors     : Array<string> = DEFAULTS_COLORS;

    constructor() {
    }

    onClick(event : MouseEvent){
        typeof this.callback === 'function' && this.callback(event.target['style'].backgroundColor);
    }

}
