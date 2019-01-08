import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-button',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ButtonStandardComponent {

    @Input() public caption: string = '';
    @Input() public handler: (...args: any[]) => any;

}
