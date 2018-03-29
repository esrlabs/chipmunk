import { Component                              } from '@angular/core';
import { events as Events                       } from '../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../core/modules/controller.config';
import { IContextMenuEvent, IContextMenuItem, EContextMenuItemTypes } from './interfaces';
@Component({
    selector    : 'context-menu',
    templateUrl : './template.html',
})

export class ContextMenu {

    private _items: Array<IContextMenuItem> = null;
    private _x: number = 0;
    private _y: number = 0;

    constructor( ){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.CONTEXT_MENU_CALL, this.showContextMenu.bind(this));
        window.addEventListener('click', this.onWindowMouseDown.bind(this));

    }

    ngOnDestroy(){
    }

    onWindowMouseDown(){
        this._items = null;
    }

    showContextMenu(event: IContextMenuEvent){
        if (!(event.items instanceof Array) || event.items.length === 0){
            return false;
        }
        this._x = event.x;
        this._y = event.y;
        this._items = event.items;
    }

    onMenuItemClick(event: MouseEvent, handler: Function){
        typeof handler === 'function' && handler();
    }

}
