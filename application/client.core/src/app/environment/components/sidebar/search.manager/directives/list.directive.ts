import { Directive, HostListener, Input } from '@angular/core';

import SearchManagerService, { EListID } from '../service/service';

@Directive({
    selector: '[appSidebarSearchManagerList]',
})

export class SidebarAppSearchManagerListDirective {

    @Input() listID: EListID;

    @HostListener('mouseover', ['$event']) onMouseOver(event: MouseEvent) {
        SearchManagerService.onMouseOver(this.listID);
    }

}
