import {Component, Input    } from '@angular/core';
import { Button             } from './handles.intreface';
import { SimpleListItem     } from '../../lists/simple/item.interface';
@Component({
    selector    : 'dialog-message-list',
    templateUrl : './template.html',
})

export class DialogMessageList {
    @Input() message        : string                = '';
    @Input() buttons        : Array<Button>         = [];
    @Input() list           : Array<SimpleListItem> = [];

    constructor() {
    }

}
