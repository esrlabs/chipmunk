import { Component } from '@angular/core';
import {events as Events} from "../../modules/controller.events";
import {configuration as Configuration} from "../../modules/controller.config";

@Component({
  selector: 'layout',
  templateUrl: './template.html',
})
export class Layout {

    constructor(){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.DENY_SELECTION_ON_BODY, this._denySelection.bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.ALLOW_SELECTION_ON_BODY, this._allowSelecting.bind(this));
    }

    private _denySelection(){
        document.body.className += 'no-user-select';
    }

    private _allowSelecting(){
        document.body.className = document.body.className.replace('no-user-select', '');
    }
}
