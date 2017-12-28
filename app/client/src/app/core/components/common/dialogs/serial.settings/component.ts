import {Component, Input, ViewChild } from '@angular/core';
import { SimpleCheckbox             } from '../../checkboxes/simple/component';
import { CommonInput                } from '../../input/component';
import { DefaultsPortSettings       } from './defaults.settings';

const defaults = new DefaultsPortSettings();
@Component({
    selector    : 'dialog-serial-settings',
    templateUrl : './template.html',
})

export class DialogSerialSettings {
    @Input() lock           : boolean       = defaults.lock;
    @Input() baudRate       : number        = defaults.baudRate;
    @Input() dataBits       : number        = defaults.dataBits;
    @Input() stopBits       : number        = defaults.stopBits;
    @Input() rtscts         : boolean       = defaults.rtscts;
    @Input() xon            : boolean       = defaults.xon;
    @Input() xoff           : boolean       = defaults.xoff;
    @Input() xany           : boolean       = defaults.xany;
    @Input() bufferSize     : number        = defaults.bufferSize;
    @Input() vmin           : number        = defaults.vmin;
    @Input() vtime          : number        = defaults.vtime;
    @Input() vtransmit      : number        = defaults.vtransmit;
    @Input() proceed        : Function      = null;
    @Input() cancel         : Function      = null;

    @ViewChild('_lock'       ) _lock        : SimpleCheckbox;
    @ViewChild('_baudRate'   ) _baudRate    : CommonInput;
    @ViewChild('_dataBits'   ) _dataBits    : CommonInput;
    @ViewChild('_stopBits'   ) _stopBits    : CommonInput;
    @ViewChild('_rtscts'     ) _rtscts      : SimpleCheckbox;
    @ViewChild('_xon'        ) _xon         : SimpleCheckbox;
    @ViewChild('_xoff'       ) _xoff        : SimpleCheckbox;
    @ViewChild('_xany'       ) _xany        : SimpleCheckbox;
    @ViewChild('_bufferSize' ) _bufferSize  : CommonInput;
    @ViewChild('_vmin'       ) _vmin        : CommonInput;
    @ViewChild('_vtime'      ) _vtime       : CommonInput;
    @ViewChild('_vtransmit'  ) _vtransmit   : CommonInput;


    constructor() {
        this.onProceed = this.onProceed.bind(this);
    }

    onProceed(){
        this.proceed({
            lock        : this._lock.getValue(),
            baudRate    : parseInt(this._baudRate.getValue(), 10),
            dataBits    : parseInt(this._dataBits.getValue(), 10),
            stopBits    : parseInt(this._stopBits.getValue(), 10),
            rtscts      : this._rtscts.getValue(),
            xon         : this._xon.getValue(),
            xoff        : this._xoff.getValue(),
            xany        : this._xany.getValue(),
            bufferSize  : parseInt(this._bufferSize.getValue(), 10),
            vmin        : parseInt(this._vmin.getValue(), 10),
            vtime       : parseInt(this._vtime.getValue(), 10),
            vtransmit   : parseInt(this._vtransmit.getValue(), 10)
        });
    }

}
