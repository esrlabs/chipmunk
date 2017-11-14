import {Component, Input, ChangeDetectorRef } from '@angular/core';

@Component({
    selector    : 'chart-edit-color-dialog',
    templateUrl : './template.html',
})

export class ChartEditColorDialog {
    @Input() callback           : Function      = null;
    @Input() colors             : Array<string> = [];
    @Input() hook               : string        = '';
    @Input() foregroundColor    : string        = 'rgb(50,250,50)';
    @Input() backgroundColor    : string        = 'rgb(250,250,250)';

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.changeDetectorRef          = changeDetectorRef;
        this.onForegroundColorSelected  = this.onForegroundColorSelected.bind(this);
        this.onBackgroundColorSelected  = this.onBackgroundColorSelected.bind(this);
        this.onKeyUp                    = this.onKeyUp.bind(this);
        this.onApply                    = this.onApply.bind(this);
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

    onKeyUp(event: KeyboardEvent){
        this.hook = event.target['value'];
    }

    onApply(){
        if (this.hook.trim() !== ''){
            typeof this.callback === 'function' && this.callback({
                hook            : this.hook,
                backgroundColor : this.backgroundColor,
                foregroundColor : this.foregroundColor
            });
        }
    }

}
