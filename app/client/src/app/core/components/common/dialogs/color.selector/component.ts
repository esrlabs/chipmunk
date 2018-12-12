import {Component, Input } from '@angular/core';

const DEFAULTS_COLORS = [
    '#000000',
    '#2d3436',
    '#636e72',
    '#b2bec3',
    '#dfe6e9',
    '#dfe6e9',
    '#FFFFFF',
    '#2ecc71',
    '#55efc4',
    '#1abc9c',
    '#5d8d5d',
    '#72a75b',
    '#6ab04c',
    '#badc58',
    '#b4d6ad',
    '#a3d0b5',
    '#81ecec',
    '#74b9ff',
    '#778beb',
    '#a29bfe',
    '#786fa6',
    '#00cec9',
    '#ffeaa7',
    '#f7d794',
    '#fdcb6e',
    '#f8a5c2',
    '#fd79a8',
    '#fab1a0',
    '#f3a683',
    '#f19066',
    '#ea8685',
    '#e66767',
    '#e17055',
    '#596275',
    '#574b90',
    '#303952',
];

@Component({
    selector    : 'simple-colors-selector-dialog',
    templateUrl : './template.html',
})

export class ColorSelectorDialog {

    @Input() callback           : Function      = null;
    @Input() colors             : Array<string> = DEFAULTS_COLORS;
    @Input() color              : string        = 'rgb(50,250,50)';

    constructor() {
        this.onColorSelected = this.onColorSelected.bind(this);
    }

    onColorSelected(color: string){
        typeof this.callback === 'function' && this.callback(color);
    }

}
