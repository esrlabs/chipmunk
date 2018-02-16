import {Component, Input, Output, ViewChild, ViewContainerRef, ChangeDetectorRef } from '@angular/core';

@Component({
    selector    : 'simple-checkbox',
    templateUrl : './template.html',
})
export class SimpleCheckbox {
    @Input() on         : string    = _('on');
    @Input() off        : string    = _('off');
    @Input() checked    : boolean   = false;
    @Input() onChange   : Function  = null;

    private disabled    : boolean   = false;

    @ViewChild ('input', { read: ViewContainerRef}) input: ViewContainerRef;

    constructor(private changeDetectorRef : ChangeDetectorRef){
        this.changeDetectorRef      = changeDetectorRef;
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onChangeInput(){
        typeof this.onChange === 'function' && this.onChange(this.getValue(), this.setValue.bind(this));
    }

    @Output() getValue(){
        return this.input.element.nativeElement.checked;
    }

    @Output() setValue(value: boolean){
        this.checked                                = value;
        this.input.element.nativeElement.checked    = value;
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
