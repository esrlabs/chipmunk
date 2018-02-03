import {ChangeDetectorRef, Component} from '@angular/core';
import { ServiceTopBarMenuItems } from '../../../services/service.topbar.menu';
import { topbarMenuHandles      } from '../../../handles/topbar.menu.hadles';
import { MenuItem               } from '../../../services/class.menu.item';
import {events as Events} from "../../../modules/controller.events";
import {configuration as Configuration} from "../../../modules/controller.config";

interface MenuHandlerCall {
    handler: string
};

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
    visible    : boolean            = true;

    constructor(private serviceTopBarMenuItems : ServiceTopBarMenuItems, private changeDetectorRef: ChangeDetectorRef){
        this.items = serviceTopBarMenuItems.getItems();
        this.handles();
        Events.bind(Configuration.sets.SYSTEM_EVENTS.MENU_HANDLER_CALL,         this.onMENU_HANDLER_CALL.bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.DESKTOP_MODE_NOTIFICATION, this.onDESKTOP_MODE_NOTIFICATION.bind(this));
    }

    handles(){
        this.items = this.items.map((item)=>{
            if (typeof item.handler === 'string' && topbarMenuHandles[item.handler] !== void 0){
                item.handler = topbarMenuHandles[item.handler];
            } else {
                item.handler = function () { };
            }
            return item;
        });
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onMENU_HANDLER_CALL(params: MenuHandlerCall){
        topbarMenuHandles[params.handler] !== void 0 && topbarMenuHandles[params.handler]();
    }

    onDESKTOP_MODE_NOTIFICATION(){
        this.visible = false;
        this.forceUpdate();
    }
}
