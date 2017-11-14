import { Component, Input               } from '@angular/core';
import { configuration as Configuration } from '../../../../modules/controller.config';
import { events as Events               } from '../../../../modules/controller.events';

@Component({
    selector    : 'shortcuts-list',
    templateUrl : './template.html',
})

export class ShortcutsList {
    @Input() popupGUID : string = '';

    public shortcuts : Array<any> = [];

    constructor() {
        this.shortcuts = Object.keys(Configuration.sets.KEYS_SHORTCUTS).map((shortcut: any)=>{
            let _shortcut = Configuration.sets.KEYS_SHORTCUTS[shortcut];
            return {
                label: _shortcut.action,
                keys : _shortcut.keys.filter((key: any)=>{ return true; })
            }
        });
    }

}
