import { Component, Input } from '@angular/core';

@Component({
    selector: 'lib-sb-title-add',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarTitleAddComponent {

    @Input() public _ng_addPort: (boolean) => void;

}
