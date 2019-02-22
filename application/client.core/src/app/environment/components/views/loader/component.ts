import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-views-loader',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewLoaderComponent {

    @Input() public comment: string = 'Welcome to logviewer';

}
