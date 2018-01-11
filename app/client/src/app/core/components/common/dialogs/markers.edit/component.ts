import {Component, Input, ChangeDetectorRef, ViewChild} from '@angular/core';
import {CommonInput} from "../../input/component";

@Component({
    selector    : 'markers-edit-dialog',
    templateUrl : './template.html',
})

export class MarkersEditDialog {
    @Input() callback           : Function      = null;
    @Input() colors             : Array<string> = [];
    @Input() hook               : string        = '';
    @Input() foregroundColor    : string        = 'rgb(50,250,50)';
    @Input() backgroundColor    : string        = 'rgb(250,250,250)';

    @ViewChild('_hook'          ) _hook         : CommonInput;

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.changeDetectorRef          = changeDetectorRef;
        this.onForegroundColorSelected  = this.onForegroundColorSelected.bind(this);
        this.onBackgroundColorSelected  = this.onBackgroundColorSelected.bind(this);
        this.onApply                    = this.onApply.bind(this);
        this.onReset                    = this.onReset.bind(this);
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onForegroundColorSelected(color: string){
        this.foregroundColor = color;
        this.forceUpdate();
    }

    onBackgroundColorSelected(color: string){
        this.backgroundColor = color;
        this.forceUpdate();
    }

    onApply(){
        this.hook = this._hook.getValue();
        if (this.hook.trim() !== ''){
            typeof this.callback === 'function' && this.callback({
                hook            : this.hook,
                backgroundColor : this.backgroundColor,
                foregroundColor : this.foregroundColor
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

}
