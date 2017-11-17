import {Component, Input} from '@angular/core';

@Component({
    selector    : 'progressbar-progress',
    templateUrl : './template.html',
})
export class ProgressBarProgress {
    @Input() css            : string = '';
    @Input() progress       : number = 0;

    constructor() {
    }

}
