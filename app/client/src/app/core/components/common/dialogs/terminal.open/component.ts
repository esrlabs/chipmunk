import {Component, Input, ViewChild } from '@angular/core';
import { CommonInput                } from '../../input/component';
@Component({
    selector    : 'dialog-terminalstream-settings',
    templateUrl : './template.html',
})

export class DialogTerminalStreamOpen {
    @Input() alias      : string        = '';
    @Input() path       : string        = '';
    @Input() keywords   : string        = '';
    @Input() proceed    : Function      = null;
    @Input() cancel     : Function      = null;

    @ViewChild('_alias'     ) _alias    : CommonInput;
    @ViewChild('_keywords'  ) _keywords : CommonInput;
    @ViewChild('_path'      ) _path     : CommonInput;


    constructor() {
        this.onProceed = this.onProceed.bind(this);
    }

    onProceed(){

        this.proceed({
            alias       : this._alias.getValue(),
            keywords    : this._keywords.getValue(),
            path        : this._path.getValue()
        });
    }

}
