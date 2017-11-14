import { Component, Input} from '@angular/core';

@Component({
    selector    : 'drop-down-menu',
    templateUrl : './template.html',
})
export class DropDownMenu {
    @Input() className  : string        = '';
    @Input() icon       : string        = '';
    @Input() caption    : string        = '';
    @Input() items      : Array<Object> = [];

    constructor(){
    }
}
