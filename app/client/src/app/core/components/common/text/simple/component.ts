import {Component, Input} from '@angular/core';

@Component({
    selector    : 'simple-text',
    templateUrl : './template.html',
})
export class SimpleText {
    @Input() text   : string = '';
    @Input() css    : string = '';

    constructor() {
    }

}
