import { Component, Input } from '@angular/core';
import { TabsService } from './service';

@Component({
    selector: 'app-tabs',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class TabsComponent {

    @Input() public service: TabsService;

    constructor() {
    }
}
