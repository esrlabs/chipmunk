import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-views-dialogs-unsupportedfile-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class DialogsUnsupportedFileActionComponent {
    @Input() file!: string;

    constructor() {}
}
