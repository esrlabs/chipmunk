import {Component, Input, ViewChild     } from '@angular/core';
import { Button                         } from './handles.intreface';
import { CommonInput                    } from "../../input/component";
import { SimpleCheckbox                 } from "../../checkboxes/simple/component";

@Component({
    selector    : 'dialog-cloud-logs',
    templateUrl : './template.html',
})

export class DialogCloudLogs {
    @Input() message        : string        = '';
    @Input() cloud          : string        = '';
    @Input() logviewer      : string        = '';
    @Input() buttons        : Array<Button> = [];

    @ViewChild('_cloud'     ) _cloud : CommonInput;
    @ViewChild('_logviewer' ) _logviewer : CommonInput;
    @ViewChild('bookmarks'  ) bookmarks : SimpleCheckbox;
    @ViewChild('filters'    ) filters : CommonInput;

    constructor() {
        this.onButtonClick = this.onButtonClick.bind(this);
    }

    onButtonClick(handle: Function){
        typeof handle === 'function' && handle({
            cloud: this._cloud !== null ? (this._cloud !== void 0 ? this._cloud.getValue() : null) : null,
            logviewer: this._logviewer !== null ? (this._logviewer !== void 0 ? this._logviewer.getValue() : null) : null,
            bookmarks: this.bookmarks.getValue(),
            filters: this.filters.getValue()
        });
    }

}
