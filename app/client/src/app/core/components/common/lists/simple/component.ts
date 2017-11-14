import {Component, Input} from '@angular/core';
import { SimpleListItem } from './item.interface';

@Component({
    selector    : 'simple-list',
    templateUrl : './template.html',
})
export class SimpleList {
    @Input() items  : Array<SimpleListItem> = [];
    @Input() css    : string                = '';

    constructor() {
    }

}
