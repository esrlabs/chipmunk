import {Component, Input, ChangeDetectorRef, ViewChild} from '@angular/core';
import {CommonInput} from "../../input/component";

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
    selector    : 'markers-edit-dialog',
    templateUrl : './template.html',
})

export class MarkersEditDialog {
    @Input() callback           : Function      = null;
    @Input() colors             : Array<string> = DEFAULTS_COLORS;
    @Input() hook               : string        = '';
    @Input() foregroundColor    : string        = 'rgb(50,250,50)';
    @Input() backgroundColor    : string        = 'rgb(250,250,250)';
    @Input() isRegExp           : boolean       = true;
    @Input() noTypeChoose       : boolean       = false;
    @Input() noHook             : boolean       = false;

    @ViewChild('_hook'          ) _hook         : CommonInput;

    private foregroundRGB : boolean = false;
    private backgroundRGB : boolean = false;
    private generateColor : boolean = true;

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.changeDetectorRef          = changeDetectorRef;
        this.onForegroundColorSelected  = this.onForegroundColorSelected.bind(this);
        this.onBackgroundColorSelected  = this.onBackgroundColorSelected.bind(this);
        this.onApply                    = this.onApply.bind(this);
        this.onReset                    = this.onReset.bind(this);
        this.onSwitchBackground         = this.onSwitchBackground.bind(this);
        this.onSwitchForeground         = this.onSwitchForeground.bind(this);
        this.onColorAutoGenerationChange= this.onColorAutoGenerationChange.bind(this);
        this.onTypeChange               = this.onTypeChange.bind(this);

    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onForegroundColorSelected(color: string){
        this.foregroundColor = color;
        //this.generateColor && (this.backgroundColor = this.getGeneratedColor(color));
        this.forceUpdate();
    }

    onBackgroundColorSelected(color: string){
        this.backgroundColor = color;
        this.generateColor && (this.foregroundColor = this.getGeneratedColor(color, true));
        this.forceUpdate();
    }

    onColorAutoGenerationChange(){
        this.generateColor = !this.generateColor;
    }

    onApply(){
        this.hook = !this.noHook ? this._hook.getValue() : '';
        if (this.hook.trim() !== '' || this.noHook){
            typeof this.callback === 'function' && this.callback({
                hook            : this.hook,
                backgroundColor : this.backgroundColor,
                foregroundColor : this.foregroundColor,
                isRegExp        : this.isRegExp
            });
        }
    }

    onReset(){
        typeof this.callback === 'function' && this.callback({
            hook            : this.hook,
            backgroundColor : '',
            foregroundColor : ''
        });
    }

    onSwitchBackground(){
        this.backgroundRGB = !this.backgroundRGB;
    }

    onSwitchForeground(){
        this.foregroundRGB = !this.foregroundRGB;
    }

    rgbToHex(rgbColor: string){
        let parts = rgbColor.replace(/[^\d\,]/gi, '').split(',');
        function componentToHex(c: number) {
            var hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
        }
        return "#" + componentToHex(parseInt(parts[0])) + componentToHex(parseInt(parts[1])) + componentToHex(parseInt(parts[2]));

    }

    getGeneratedColor (rgb: string, bw: boolean = false) {
        function padZero(str: string, len?: number){
            len = len || 2;
            var zeros = new Array(len).join('0');
            return (zeros + str).slice(-len);
        }

        let hex = this.rgbToHex(rgb);

        if (hex.indexOf('#') === 0) {
            hex = hex.slice(1);
        }
        // convert 3-digit hex to 6-digits.
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        if (hex.length !== 6) {
            throw new Error('Invalid HEX color.');
        }
        var r = parseInt(hex.slice(0, 2), 16),
            g = parseInt(hex.slice(2, 4), 16),
            b = parseInt(hex.slice(4, 6), 16);
        if (bw) {
            // http://stackoverflow.com/a/3943023/112731
            return (r * 0.299 + g * 0.587 + b * 0.114) > 186
                ? '#000000'
                : '#FFFFFF';
        }
        // pad each with zeros and return
        return "#" + padZero((255 - r).toString(16)) + padZero((255 - g).toString(16)) + padZero((255 - b).toString(16));
        //https://stackoverflow.com/questions/35969656/how-can-i-generate-the-opposite-color-according-to-current-color
    }

    onTypeChange(){
        this.isRegExp = !this.isRegExp;
    }

}
