import {Component, Input, ViewChild } from '@angular/core';
import { SimpleCheckbox             } from '../../checkboxes/simple/component';
import { CommonInput                } from '../../input/component';
@Component({
    selector    : 'dialog-adblogcatstream-settings',
    templateUrl : './template.html',
})

export class DialogADBLogcatStreamSettings {
    @Input() V          : boolean       = true;
    @Input() I          : boolean       = true;
    @Input() D          : boolean       = true;
    @Input() W          : boolean       = true;
    @Input() E          : boolean       = true;
    @Input() S          : boolean       = true;
    @Input() F          : boolean       = true;
    @Input() tid        : number        = -1;
    @Input() pid        : number        = -1;
    @Input() path       : string        = '';
    @Input() proceed    : Function      = null;
    @Input() cancel     : Function      = null;

    @ViewChild('_level_V'       ) _level_V  : SimpleCheckbox;
    @ViewChild('_level_I'       ) _level_I  : SimpleCheckbox;
    @ViewChild('_level_D'       ) _level_D  : SimpleCheckbox;
    @ViewChild('_level_W'       ) _level_W  : SimpleCheckbox;
    @ViewChild('_level_E'       ) _level_E  : SimpleCheckbox;
    @ViewChild('_level_S'       ) _level_S  : SimpleCheckbox;
    @ViewChild('_level_F'       ) _level_F  : SimpleCheckbox;
    @ViewChild('_tid'           ) _tid      : CommonInput;
    @ViewChild('_pid'           ) _pid      : CommonInput;
    @ViewChild('_path'          ) _path     : CommonInput;


    constructor() {
        this.onProceed = this.onProceed.bind(this);
    }

    onProceed(){
        let levels = {};
        ['V', 'I', 'E', 'D', 'F', 'S', 'W'].forEach((key)=>{
            levels[key] = this['_level_' + key].getValue();
        });
        this.proceed({
            levels : levels,
            tid    : parseInt(this._tid.getValue(), 10),
            pid    : parseInt(this._pid.getValue(), 10),
            path   : this._path.getValue()
        });
    }

}
