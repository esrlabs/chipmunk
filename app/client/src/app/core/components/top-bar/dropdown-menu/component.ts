import { Component              } from '@angular/core';
import { ServiceTopBarMenuItems } from '../../../services/service.topbar.menu';
import { topbarMenuHandles      } from '../../../handles/topbar.menu.hadles';
import { MenuItem               } from '../../../services/class.menu.item';

@Component({
    selector    : 'top-bar-drop-down-menu',
    templateUrl : './template.html',
    providers   : [ServiceTopBarMenuItems]
})

export class TopBarDropDownMenu {
    className  : string             = 'top-bar-correction';
    icon       : string             = 'fa-navicon';
    caption    : string             = null;
    items      : Array<MenuItem>    = [];

    constructor(private serviceTopBarMenuItems : ServiceTopBarMenuItems){
        this.items = serviceTopBarMenuItems.getItems();
        this.handles();
    }

    handles(){
        this.items = this.items.map((item)=>{
            if (typeof item.handle === 'string' && topbarMenuHandles[item.handle] !== void 0){
                item.handle = topbarMenuHandles[item.handle];
            } else {
                item.handle = function () { };
            }
            return item;
        });
    }
}
