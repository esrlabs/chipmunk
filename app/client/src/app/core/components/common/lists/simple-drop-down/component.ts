import {Component, Input} from '@angular/core';
import { SimpleListItem } from './item.interface';

@Component({
    selector    : 'simple-dd-list',
    templateUrl : './template.html',
})
export class SimpleDropDownList {
    @Input() items      : Array<SimpleListItem> = [];
    @Input() css        : string                = '';
    @Input() onChange   : Function              = null;
    @Input() defaults   : string                = '';

    constructor() {
    }

    onChangeSelect(event: Event){
        typeof this.onChange === 'function' && this.onChange(event.target['value']);
    }

}
