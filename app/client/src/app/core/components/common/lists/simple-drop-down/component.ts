import {Component, Input, AfterContentInit, Output, ViewContainerRef, ViewChild} from '@angular/core';
import { SimpleListItem } from './item.interface';

@Component({
    selector    : 'simple-dd-list',
    templateUrl : './template.html',
})
export class SimpleDropDownList implements AfterContentInit{
    @Input() items      : Array<SimpleListItem> = [];
    @Input() css        : string                = '';
    @Input() onChange   : Function              = null;
    @Input() defaults   : string                = '';

    @ViewChild ('list', { read: ViewContainerRef}) list: ViewContainerRef;

    constructor() {
    }

    ngAfterContentInit(){

    }

    @Output() getValue(){
        return this.list.element.nativeElement.value;
    }

    onChangeSelect(event: Event){
        this.defaults = event.target['value'];
        typeof this.onChange === 'function' && this.onChange(event.target['value']);
    }

}
