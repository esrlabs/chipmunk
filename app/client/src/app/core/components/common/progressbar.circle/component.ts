import {Component, Input} from '@angular/core';

@Component({
    selector    : 'progressbar-circle',
    templateUrl : './template.html',
})
export class ProgressBarCircle {
    @Input() caption        : string = '';
    @Input() css            : string = '';

    constructor() {
    }

}
