import {Component, Input, ViewChild     } from '@angular/core';
import { Button                         } from './handles.intreface';
import { CommonInput                    } from "../../input/component";
import { SimpleCheckbox                 } from "../../checkboxes/simple/component";

@Component({
    selector    : 'dialog-save-logs',
    templateUrl : './template.html',
})

export class DialogSaveLogs {
    @Input() message        : string        = '';
    @Input() filename       : string        = '';
    @Input() buttons        : Array<Button> = [];

    @ViewChild('input'      ) input : CommonInput;
    @ViewChild('bookmarks'  ) bookmarks : SimpleCheckbox;
    @ViewChild('filters'    ) filters : SimpleCheckbox;
    @ViewChild('remarks'    ) remarks : SimpleCheckbox;

    constructor() {
        this.onButtonClick = this.onButtonClick.bind(this);
    }

    onButtonClick(handle: Function){
        typeof handle === 'function' && handle({
            filename: this.input !== null ? (this.input !== void 0 ? this.input.getValue() : null) : null,
            bookmarks: this.bookmarks.getValue(),
            filters: this.filters.getValue(),
            remarks: this.remarks.getValue()
        });
    }

}
