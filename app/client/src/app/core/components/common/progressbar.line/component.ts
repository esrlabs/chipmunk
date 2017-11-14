import {Component, Input} from '@angular/core';

@Component({
    selector    : 'progressbar-line',
    templateUrl : './template.html',
})
export class ProgressBarLine {
    @Input() css            : string = '';

    constructor() {
    }

}
