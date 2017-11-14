import { EventEmitter, Input    } from '@angular/core';
import { ViewClass              } from '../../core/services/class.view';

class TabController {
    @Input() viewParams : ViewClass         = null;
    @Input() onSelect   : EventEmitter<any> = null;
    @Input() onDeselect : EventEmitter<any> = null;
    @Input() onResize   : EventEmitter<any> = null;

}

export { TabController }