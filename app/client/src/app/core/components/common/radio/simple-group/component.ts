import {Component, Input, Output, ViewChild, ViewContainerRef, ChangeDetectorRef } from '@angular/core';

import { RadioButton } from './interface.buttons';

@Component({
    selector    : 'simple-radio-group',
    templateUrl : './template.html',
})

export class SimpleRadioGroup {
    @Input() buttons    : Array<RadioButton>    = [];
    @Input() selected   : number                = -1;

    private disabled    : boolean   = false;

    constructor(private changeDetectorRef : ChangeDetectorRef){
        this.changeDetectorRef = changeDetectorRef;
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }


    getIndexByID(id: string | symbol){
        let index = -1;
        this.buttons.forEach((button: RadioButton, i) => {
            button.id === id && (index = i);
        });
        return index;
    }

    onChange(event: MouseEvent, index: number){
        this.selected = index;
    }

    @Output() getValue(){
        return ~this.selected ? null : (this.buttons[this.selected] !== void 0 ? this.buttons[this.selected] : null);
    }

    @Output() setSelected(id: string | symbol){
        let index = this.getIndexByID(id);
        if (~index){
            this.selected = index;
        }
        this.forceUpdate();
    }

    @Output() disable(){
        this.disabled = true;
        this.forceUpdate();
    }

    @Output() enable(){
        this.disabled = false;
        this.forceUpdate();
    }
}
